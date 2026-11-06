import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const load = (file) => JSON.parse(fs.readFileSync(new URL(`../n8n/${file}`, import.meta.url), 'utf8'));
const node = (workflow, name) => workflow.nodes.find((entry) => entry.name === name);
const w16 = load('16-send-doctor-message.json');
const builder = node(w16, 'Build Doctor Email').parameters.jsCode;
const route = { recipient: 'doctor@example.com', subject: 'Test subject', message_text: 'Plain text', action_url: '' };
const build = (emailJson) => new Function('$json', '$', builder)(route, () => ({ first: () => ({ json: { email_json: emailJson } }) }))[0].json;

test('workflow 16 builds the branded doctor email from email_json, and keeps plain text without it', () => {
  const html = build(JSON.stringify({
    greeting: 'Hello Dr. Test,', intro: ['Your article is ready for your review:'],
    items: [{ title: 'Why <Gums> Bleed', url: 'https://apex-content-interviewer.jdold.workers.dev/review/abc', button: 'Review your article' }],
    after: ['Please review it by **Monday, November 10**.'],
  })).message_html;
  assert.match(html, /brand\/email-logo\.png/);
  assert.match(html, /href="https:\/\/apex-content-interviewer\.jdold\.workers\.dev\/review\/abc"[^>]*>Review your article<\/a>/);
  assert.match(html, /Why &lt;Gums&gt; Bleed/, 'text is escaped');
  assert.match(html, /<b>Monday, November 10<\/b>/);
  assert.match(html, /Reimagining dentistry to change the lives of our patients, teammates, and the communities we serve\./);
  assert.match(html, /PRIVATE PRACTICE REIMAGINED&reg;/);
  assert.doesNotMatch(html, /#8AC441|#e8f4fa|#eef6fb/i, 'no green bar or light-blue boxes');
  assert.equal(build('').message_html, '');
  assert.throws(() => build(JSON.stringify({ items: [{ title: 'x', url: 'javascript:alert(1)', button: 'Go' }] })), /valid secure link/);
  const send = node(w16, 'Send Doctor Email').parameters;
  assert.equal(send.emailType, "={{ $json.message_html ? 'html' : 'text' }}");
  assert.match(send.message, /\$json\.message_html \|\|/);
  assert.ok(node(w16, 'Receive Doctor Message Internally').parameters.workflowInputs.values.some((value) => value.name === 'email_json'));
  assert.equal(w16.connections['Is Email Delivery Available?'].main[0][0].node, 'Build Doctor Email');
  assert.equal(w16.connections['Build Doctor Email'].main[0][0].node, 'Send Doctor Email');
});

const passesEmailJson = (workflow, callName) => {
  const call = node(workflow, callName).parameters.workflowInputs;
  assert.match(call.value.email_json, /\$json\.email_json/);
  assert.ok(call.schema.some((entry) => entry.id === 'email_json'));
};

test('the invitation, review request, reminder, and resent-link emails all use the branded design', () => {
  // 02: campaign invitation, one button per topic.
  const w02 = load('02-dispatch-campaign-invitations.json');
  const rows = [1, 2, 3].map((n) => ({ json: { campaign_id: 'c1', doctor_id: 'd1', campaign_name: 'January', doctor_name: 'Dr. Test', preview_only: false,
    interview_deadline: '2026-12-15', training_resource_url: 'https://example.com/guide', topic_title: 'Topic ' + n, topic_sort_order: n, interview_url: 'https://apex-content-interviewer.jdold.workers.dev/interview/t' + n } }));
  const invitation = new Function('$input', node(w02, 'Compose three-topic invitation').parameters.jsCode)({ all: () => rows })[0].json;
  const inviteHtml = build(invitation.email_json).message_html;
  assert.equal((inviteHtml.match(/>Start this interview<\/a>/g) || []).length, 3);
  assert.match(inviteHtml, /<b>December 15, 2026<\/b>/);
  assert.match(inviteHtml, />Optional quick training guide<\/a>/);
  assert.match(invitation.message_text, /interview\/t1/, 'the plain-text version is kept for the record');
  passesEmailJson(w02, 'Send invitation through private router');

  // 07: article ready for review.
  const w07 = load('07-create-doctor-review-link.json');
  const review = new Function('$json', node(w07, 'Prepare Doctor Review Message').parameters.jsCode)({ doctor_id: 'd1', article_id: 'a1', campaign_id: 'c1', doctor_name: 'Dr. Test',
    article_title: 'Why Do My Gums Bleed?', current_version: 1, expires_at: '2026-11-10T18:00:00Z', review_url: 'https://apex-content-interviewer.jdold.workers.dev/review/r1' }).json;
  const reviewHtml = build(review.email_json).message_html;
  assert.match(reviewHtml, />Review your article<\/a>/);
  assert.match(reviewHtml, /<b>Tuesday, November 10<\/b>/);
  passesEmailJson(w07, 'Send Doctor Review Invitation Privately');

  // 17: reminder (built in SQL) and a complete mapping to workflow 16.
  const w17 = load('17-doctor-review-reminders.json');
  const query = node(w17, 'Prepare 48-Hour Review Reminders').parameters;
  assert.match(query.sqlQuery ?? query.query, /TO_JSON_STRING\(STRUCT\([\s\S]*'Review your article' AS button[\s\S]*\) AS email_json/);
  const call17 = node(w17, "Call 'AAC - 16 - Send Doctor Message'").parameters.workflowInputs;
  for (const field of ['doctor_id', 'article_id', 'subject', 'message_text', 'action_url', 'email_json']) assert.ok(call17.value[field], field);

  // 24: resent interview links.
  const w24 = load('24-admin-command-router.json');
  const resent = new Function('$input', node(w24, 'Compose Interview Links Email').parameters.jsCode)({ all: () => [rows[1]] })[0].json;
  const resentHtml = build(resent.email_json).message_html;
  assert.match(resentHtml, /here is your interview link again/);
  assert.match(resentHtml, /Any earlier links you received still work/);
  passesEmailJson(w24, 'Email Interview Links');
});
