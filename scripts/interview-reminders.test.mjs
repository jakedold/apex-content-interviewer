import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const workflow = JSON.parse(read('n8n/26-interview-reminders.json'));
const node = (name) => workflow.nodes.find((entry) => entry.name === name);

test('interview reminders follow the campaign setting and stop when the doctor or a colleague finishes', () => {
  const sql = node('Prepare Interview Reminders').parameters.sqlQuery;
  assert.match(sql, /IF\(TIMESTAMP_DIFF\(deadline_end, invited_at, HOUR\) >= 14 \* 24, 'two', 'one'\)/, 'auto: two reminders for two weeks or more');
  assert.match(sql, /INTERVAL 7 DAY[\s\S]*'INTERVIEW_REMINDER_7D'/);
  assert.match(sql, /INTERVAL 2 DAY\) AND CURRENT_TIMESTAMP\(\) < deadline_end THEN 'INTERVIEW_REMINDER_2D'/);
  assert.match(sql, /INTERVAL 3 DAY\) AND CURRENT_TIMESTAMP\(\) < deadline_end THEN 'INTERVIEW_REMINDER_3D'/);
  assert.match(sql, /TIMESTAMP_ADD\(invited_at, INTERVAL 10 DAY\) THEN 'INTERVIEW_REMINDER_10D'/);
  assert.match(sql, /cd\.invited_at <= TIMESTAMP_SUB\(CURRENT_TIMESTAMP\(\), INTERVAL 2 DAY\)/, 'none within 2 days of the invitation');
  assert.match(sql, /cp\.doctor_id IS NULL AND pc\.practice_id IS NULL AND ar\.entity_id IS NULL/, 'stops for finished doctors, covered practices, and archived rows');
  assert.match(sql, />= 300/, 'a colleague counts once their interview has 300 words or more');
  assert.match(sql, /s\.doctor_id IS NULL/, 'each reminder is sent once');
  assert.match(sql, /TO_HEX\(SHA256\(raw_token\)\)/);
  assert.doesNotMatch(sql, /SUPERSEDED/, 'earlier links keep working');
  assert.doesNotMatch(sql, /COALESCE\(\(SELECT MAX\(/);
  assert.equal(workflow.active, false);
  assert.ok(workflow.nodes.every((entry) => !entry.credentials));
  const send = node('Send Interview Reminder').parameters;
  assert.equal(send.mode, 'each', 'one doctor message per email');
  assert.equal(send.workflowId.value, 'cZtS9x6kbI46Q2Bi');
  assert.match(send.workflowInputs.value.email_json, /email_json/);
  assert.equal(JSON.parse(read('n8n/17-doctor-review-reminders.json')).nodes.find((entry) => entry.name === "Call 'AAC - 16 - Send Doctor Message'").parameters.mode, 'each');
});

test('each doctor gets one reminder email with a button per topic', () => {
  const rows = [2, 1].map((n) => ({ json: { campaign_id: 'c1', doctor_id: 'd1', doctor_name: 'Dr. Test', campaign_name: 'January Expert Article', preview_only: false,
    interview_deadline: '2026-12-14', reminder_type: 'INTERVIEW_REMINDER_2D', topic_title: 'Topic ' + n, topic_sort_order: n, interview_url: 'https://example.test/interview/' + n } }));
  const emails = new Function('$input', node('Compose Interview Reminder Emails').parameters.jsCode)({ all: () => rows });
  assert.equal(emails.length, 1);
  const email = emails[0].json;
  assert.equal(email.communication_type, 'INTERVIEW_REMINDER_2D');
  assert.equal(email.subject, 'Reminder: your article interview is due Monday, December 14');
  const layout = JSON.parse(email.email_json);
  assert.deepEqual(layout.items.map((item) => item.title), ['Topic 1', 'Topic 2']);
  assert.match(layout.after.join(' '), /\*\*Monday, December 14\*\*/);
  assert.match(email.message_text, /If you have already finished your interview, thank you/);
});

test('the campaign builder saves the interview reminder setting', () => {
  const client = read('src/admin.ts');
  assert.match(client, /<select name="interview_reminders">/);
  assert.match(client, /interview_reminders: String\(data\.get\('interview_reminders'\) \?\? 'auto'\)/);
  const router = JSON.parse(read('n8n/24-admin-command-router.json'));
  const validate = router.nodes.find((entry) => entry.name === 'Validate and Normalize Command').parameters.jsCode;
  assert.match(validate, /\['auto', 'two', 'one', 'none'\]\.includes\(interviewReminders\)/);
  const launch = router.nodes.find((entry) => entry.name === 'Create Audited Campaign').parameters;
  assert.match(launch.sqlQuery, /ADD COLUMN IF NOT EXISTS interview_reminders STRING/);
  assert.ok(launch.options.queryParameters.namedParameters.some((param) => param.name === 'interview_reminders'));
});
