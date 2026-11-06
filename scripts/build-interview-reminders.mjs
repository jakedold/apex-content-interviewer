// Builds n8n/26-interview-reminders.json: hourly interview reminders for doctors who have not finished an interview.
// Run: node scripts/build-interview-reminders.mjs
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const t = (name) => '`apex-marketing-n8n.automated_article_creation.' + name + '`';
const reviewReminders = JSON.parse(fs.readFileSync(new URL('n8n/17-doctor-review-reminders.json', root), 'utf8'));
const template = (name) => structuredClone(reviewReminders.nodes.find((node) => node.name === name));

const sql = `-- AAC 26: interview reminders.
-- Campaign setting (interview_reminders): auto = two reminders when doctors have two weeks or more before the deadline,
-- otherwise one; two = 7 and 2 days before the deadline; one = 3 days before; none = no reminders. Without a deadline,
-- one reminder 10 days after the invitation (unless none). No reminder within 2 days of the invitation.
-- Reminders go only to doctors with no completed interview in the campaign, and stop once a colleague at the same
-- practice completes one (300 words or more), or when the doctor's row is archived. Each reminder is sent once.
CREATE TEMP TABLE reminder_candidates AS
WITH completed AS (
  SELECT DISTINCT campaign_id, doctor_id FROM ${t('interviews')} WHERE completed_at IS NOT NULL
),
practice_covered AS (
  SELECT DISTINCT i.campaign_id, d.practice_id
  FROM ${t('interviews')} i JOIN ${t('doctors')} d ON d.doctor_id = i.doctor_id
  WHERE i.completed_at IS NOT NULL AND ARRAY_LENGTH(REGEXP_EXTRACT_ALL(TRIM(COALESCE(i.transcript, '')), r'\\S+')) >= 300
),
archived AS (
  SELECT entity_id FROM ${t('workflow_events')}
  WHERE entity_type = 'work_item' AND event_type IN ('work_item.archived', 'work_item.restored')
  QUALIFY ROW_NUMBER() OVER (PARTITION BY entity_id ORDER BY event_timestamp DESC) = 1 AND event_type = 'work_item.archived'
),
sent AS (
  SELECT DISTINCT campaign_id, doctor_id, communication_type FROM ${t('communications')}
  WHERE status = 'SENT' AND STARTS_WITH(communication_type, 'INTERVIEW_REMINDER_')
),
base AS (
  SELECT cd.campaign_id, cd.doctor_id, cd.invited_at, d.doctor_name, c.campaign_name,
    COALESCE(c.preview_only, FALSE) AS preview_only,
    JSON_VALUE(TO_JSON_STRING(c), '$.interview_deadline') AS interview_deadline,
    COALESCE(NULLIF(LOWER(JSON_VALUE(TO_JSON_STRING(c), '$.interview_reminders')), ''), 'auto') AS reminder_setting,
    IF(SAFE_CAST(JSON_VALUE(TO_JSON_STRING(c), '$.interview_deadline') AS DATE) IS NULL, NULL,
      TIMESTAMP(DATETIME(DATE_ADD(SAFE_CAST(JSON_VALUE(TO_JSON_STRING(c), '$.interview_deadline') AS DATE), INTERVAL 1 DAY), TIME '00:00:00'), 'America/Chicago')) AS deadline_end
  FROM ${t('campaign_doctors')} cd
  JOIN ${t('campaigns')} c ON c.campaign_id = cd.campaign_id
  JOIN ${t('doctors')} d ON d.doctor_id = cd.doctor_id
  LEFT JOIN completed cp ON cp.campaign_id = cd.campaign_id AND cp.doctor_id = cd.doctor_id
  LEFT JOIN practice_covered pc ON pc.campaign_id = cd.campaign_id AND pc.practice_id = d.practice_id
  LEFT JOIN archived ar ON ar.entity_id = CONCAT(cd.campaign_id, ':', cd.doctor_id)
  WHERE c.status = 'LAUNCHED'
    AND JSON_VALUE(TO_JSON_STRING(c), '$.archived_at') IS NULL
    AND cd.invited_at IS NOT NULL
    AND cd.invited_at <= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 2 DAY)
    AND d.active = TRUE AND NULLIF(TRIM(d.email), '') IS NOT NULL
    AND cp.doctor_id IS NULL AND pc.practice_id IS NULL AND ar.entity_id IS NULL
),
planned AS (
  SELECT *,
    CASE
      WHEN reminder_setting = 'none' THEN 'none'
      WHEN deadline_end IS NULL THEN 'no_deadline'
      WHEN reminder_setting = 'auto' THEN IF(TIMESTAMP_DIFF(deadline_end, invited_at, HOUR) >= 14 * 24, 'two', 'one')
      ELSE reminder_setting
    END AS plan
  FROM base
),
due AS (
  SELECT *,
    CASE
      WHEN plan = 'two' AND CURRENT_TIMESTAMP() >= TIMESTAMP_SUB(deadline_end, INTERVAL 2 DAY) AND CURRENT_TIMESTAMP() < deadline_end THEN 'INTERVIEW_REMINDER_2D'
      WHEN plan = 'two' AND CURRENT_TIMESTAMP() >= TIMESTAMP_SUB(deadline_end, INTERVAL 7 DAY) AND CURRENT_TIMESTAMP() < deadline_end THEN 'INTERVIEW_REMINDER_7D'
      WHEN plan = 'one' AND CURRENT_TIMESTAMP() >= TIMESTAMP_SUB(deadline_end, INTERVAL 3 DAY) AND CURRENT_TIMESTAMP() < deadline_end THEN 'INTERVIEW_REMINDER_3D'
      WHEN plan = 'no_deadline' AND CURRENT_TIMESTAMP() >= TIMESTAMP_ADD(invited_at, INTERVAL 10 DAY) THEN 'INTERVIEW_REMINDER_10D'
    END AS reminder_type
  FROM planned
)
SELECT due.* FROM due
LEFT JOIN sent s ON s.campaign_id = due.campaign_id AND s.doctor_id = due.doctor_id AND s.communication_type = due.reminder_type
WHERE due.reminder_type IS NOT NULL AND s.doctor_id IS NULL
ORDER BY due.deadline_end, due.campaign_id, due.doctor_id
LIMIT 50;

-- Fresh single-use links for every active topic (earlier links keep working). Only a hash of each token is stored.
CREATE TEMP TABLE new_links AS
SELECT GENERATE_UUID() AS link_id, r.*, tp.topic_id, tp.topic_title, tp.topic_sort_order,
  CONCAT(REPLACE(GENERATE_UUID(), '-', ''), REPLACE(GENERATE_UUID(), '-', '')) AS raw_token,
  COALESCE(r.deadline_end, TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL 3650 DAY)) AS expires_at
FROM reminder_candidates r
JOIN ${t('campaign_topics')} tp ON tp.campaign_id = r.campaign_id AND tp.active = TRUE;

INSERT INTO ${t('interview_links')}
(link_id, campaign_id, doctor_id, topic_id, secure_token_hash, status, created_at, expires_at, first_opened_at, used_at, interview_id)
SELECT link_id, campaign_id, doctor_id, topic_id, TO_HEX(SHA256(raw_token)), 'READY', CURRENT_TIMESTAMP(), expires_at, NULL, NULL, NULL
FROM new_links;

SELECT campaign_id, doctor_id, doctor_name, campaign_name, preview_only, interview_deadline, reminder_type,
  topic_title, topic_sort_order,
  CONCAT('https://apex-content-interviewer.jdold.workers.dev/interview/', raw_token) AS interview_url
FROM new_links
ORDER BY campaign_id, doctor_id, topic_sort_order;`;

const composeCode = `// One reminder email per doctor, with a button for each topic (branded design via workflow 16).
const rows = $input.all().map((item) => item.json).filter((row) => row.interview_url);
const groups = new Map();
for (const row of rows) {
  const key = row.campaign_id + '::' + row.doctor_id;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(row);
}
const emails = [];
for (const group of groups.values()) {
  group.sort((a, b) => Number(a.topic_sort_order) - Number(b.topic_sort_order));
  const first = group[0];
  const previewOnly = first.preview_only === true || String(first.preview_only).toLowerCase() === 'true';
  const deadline = String(first.interview_deadline || '').slice(0, 10);
  const deadlineLabel = deadline ? new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(deadline + 'T12:00:00Z')) : '';
  const several = group.length > 1;
  const intro = 'A friendly reminder that your article interview for ' + first.campaign_name + ' is still open. It takes about 10 minutes, and we turn the conversation into an article for your practice website.';
  const pick = several ? 'Pick the topic you would most like to talk about:' : 'Here is your interview link:';
  const deadlineLine = deadline ? 'Please complete your interview by **' + deadlineLabel + '** (Central Time).' : '';
  const tip = 'Before you begin, choose a quiet place; headphones with a microphone help. Please do not include patient-identifying information.';
  const done = 'If you have already finished your interview, thank you, and please ignore this email.';
  const lines = ['Hello ' + first.doctor_name + ',', '', intro, '', pick, ''];
  for (const row of group) lines.push((several ? row.topic_sort_order + '. ' : '') + row.topic_title, row.interview_url, '');
  if (deadlineLine) lines.push(deadlineLine.replace(/\\*\\*/g, ''), '');
  lines.push(tip, '', done, '', 'Apex Dental Partners');
  emails.push({ json: {
    doctor_id: first.doctor_id,
    article_id: '',
    campaign_id: first.campaign_id,
    communication_type: first.reminder_type,
    subject: first.reminder_type === 'INTERVIEW_REMINDER_2D' ? 'Reminder: your article interview is due ' + deadlineLabel : 'Reminder: your article interview for ' + first.campaign_name,
    message_text: lines.join(String.fromCharCode(10)),
    action_url: '',
    email_json: JSON.stringify({
      greeting: 'Hello ' + first.doctor_name + ',',
      intro: [intro, pick],
      items: group.map((row) => ({ title: row.topic_title, url: row.interview_url, button: previewOnly ? 'Try this interview' : 'Start this interview' })),
      after: [deadlineLine, tip, done].filter(Boolean),
    }),
  } });
}
return emails;`;

const schedule = template('Check Review Reminders Hourly');
schedule.name = 'Check Interview Reminders Hourly';
schedule.id = 'aac-26-schedule';
schedule.parameters = { rule: { interval: [{ field: 'cronExpression', expression: '40 * * * *' }] } };
schedule.position = [0, 300];
const manual = template('Run Reminder Check Manually');
manual.name = 'Run Interview Reminder Check Manually';
manual.id = 'aac-26-manual';
manual.position = [0, 500];
const prepare = template('Prepare 48-Hour Review Reminders');
prepare.name = 'Prepare Interview Reminders';
prepare.id = 'aac-26-prepare';
prepare.position = [260, 400];
delete prepare.credentials;
prepare.parameters = { ...prepare.parameters, sqlQuery: sql, options: { location: 'US' } };
delete prepare.parameters.query;
prepare.retryOnFail = true; prepare.maxTries = 3; prepare.waitBetweenTries = 3000;
const compose = { parameters: { jsCode: composeCode }, id: 'aac-26-compose', name: 'Compose Interview Reminder Emails', type: 'n8n-nodes-base.code', typeVersion: 2, position: [520, 400] };
const send = template("Call 'AAC - 16 - Send Doctor Message'");
send.name = 'Send Interview Reminder';
send.id = 'aac-26-send';
send.position = [780, 400];
send.parameters.mode = 'each';
const notes = {
  parameters: { content: '## AAC 26 - Interview Reminders\n\nRuns hourly at minute 40. Emails doctors who have not finished their campaign interview, following the campaign\'s **Interview reminders** setting (auto, two, one, or none). Each reminder is sent once and includes fresh links for every topic; earlier links keep working. Reminders stop once the doctor or a colleague at the same practice finishes an interview, or the doctor\'s row is archived.\n\nConnect **Google BigQuery account**, test with **Run Interview Reminder Check Manually**, then activate.', height: 300, width: 520 },
  id: 'aac-26-notes', name: 'Interview Reminder Notes', type: 'n8n-nodes-base.stickyNote', typeVersion: 1, position: [0, 0],
};
const workflow = {
  name: 'AAC - 26 - Interview Reminders',
  nodes: [schedule, manual, prepare, compose, send, notes],
  connections: {
    [schedule.name]: { main: [[{ node: prepare.name, type: 'main', index: 0 }]] },
    [manual.name]: { main: [[{ node: prepare.name, type: 'main', index: 0 }]] },
    [prepare.name]: { main: [[{ node: compose.name, type: 'main', index: 0 }]] },
    [compose.name]: { main: [[{ node: send.name, type: 'main', index: 0 }]] },
  },
  active: false,
  settings: { executionOrder: 'v1', timezone: 'America/Chicago' },
  versionId: 'interview-reminders-2026-11',
  meta: { templateCredsSetupCompleted: false },
  tags: [],
};
fs.writeFileSync(new URL('n8n/26-interview-reminders.json', root), JSON.stringify(workflow, null, 2) + '\n');
