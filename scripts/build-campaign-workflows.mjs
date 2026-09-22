import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve(import.meta.dirname, '..', 'n8n');
const write = (name, value) => fs.writeFileSync(path.join(out, name), `${JSON.stringify(value, null, 2)}\n`);
const edge = (target) => ({ main: [[{ node: target, type: 'main', index: 0 }]] });
const bq = (id, name, sqlQuery, position, parameters = []) => ({
  id, name, type: 'n8n-nodes-base.googleBigQuery', typeVersion: 2.1, position,
  parameters: {
    authentication: 'serviceAccount',
    projectId: { __rl: true, value: 'apex-marketing-n8n', mode: 'id' },
    sqlQuery,
    options: { location: 'US', ...(parameters.length ? { queryParameters: { namedParameters: parameters } } : {}) },
  },
});

const formField = (fieldName, fieldLabel, fieldType, extra = {}) => ({
  fieldName, fieldLabel, fieldType, requiredField: true, ...extra,
});

const launch = {
  name: 'AAC - 01 - Launch Article Campaign',
  nodes: [
    {
      id: 'aac-launch-campaign-form', name: 'Start a campaign',
      type: 'n8n-nodes-base.formTrigger', typeVersion: 2.2, position: [-620, 80],
      webhookId: 'aac-launch-article-campaign',
      parameters: {
        authentication: 'basicAuth',
        formTitle: 'Start an article campaign',
        formDescription: 'Choose one configured location and its website, then enter three topics and the doctors to invite. One invitation with three secure topic links will be sent to each doctor. This does not publish an article.',
        formFields: { values: [
          formField('campaign_name', 'Campaign name', 'text', { placeholder: 'October 2026 Test Campaign' }),
          formField('campaign_month', 'Campaign month', 'date'),
          formField('practice_name', 'Location / practice name', 'text', { placeholder: 'Exact name of the configured location' }),
          formField('website_url', 'Website URL for this location', 'text', { placeholder: 'https://example.com' }),
          formField('topic_1', 'Topic 1', 'text'),
          formField('topic_2', 'Topic 2', 'text'),
          formField('topic_3', 'Topic 3', 'text'),
          formField('doctors', 'Doctors (one Name,email per line)', 'textarea', { placeholder: 'Dr. Example One,example1@apexdp.com\nDr. Example Two,example2@apexdp.com' }),
        ] },
        responseMode: 'lastNode',
        options: { path: 'aac-launch-article-campaign', buttonLabel: 'Launch campaign', ignoreBots: true },
      },
    },
    {
      id: 'aac-validate-campaign', name: 'Validate campaign details',
      type: 'n8n-nodes-base.code', typeVersion: 2, position: [-340, 80],
      parameters: { mode: 'runOnceForEachItem', jsCode: `const input = $json;
const value = (name, label) => String(input[name] ?? input[label] ?? '').trim();
const campaignName = value('campaign_name', 'Campaign name');
const month = value('campaign_month', 'Campaign month').slice(0, 7);
const practiceName = value('practice_name', 'Location / practice name');
const websiteInput = value('website_url', 'Website URL for this location');
let websiteUrl;
try {
  const parsed = new URL(websiteInput);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error('invalid URL');
  websiteUrl = parsed.href.replace(/\\/$/, '').toLowerCase();
} catch {
  throw new Error('Enter the configured HTTPS website URL for this location, without query parameters or fragments.');
}
const topics = [1, 2, 3].map((number) => value('topic_' + number, 'Topic ' + number));
const lines = value('doctors', 'Doctors (one Name,email per line)').split(/\\r?\\n/).map((line) => line.trim()).filter(Boolean);
if (!campaignName || !/^\\d{4}-\\d{2}$/.test(month) || !practiceName || topics.some((topic) => !topic) || !lines.length) throw new Error('Complete the campaign, month, location, website, three topics, and at least one doctor.');
if (new Set(topics.map((topic) => topic.toLowerCase())).size !== 3) throw new Error('The three topics must be distinct.');
const doctors = lines.map((line) => {
  const comma = line.lastIndexOf(',');
  if (comma < 1) throw new Error('Each doctor line must be Name,email.');
  const name = line.slice(0, comma).trim();
  const email = line.slice(comma + 1).trim().toLowerCase();
  if (!name || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) throw new Error('Invalid doctor name or email: ' + line);
  return { doctor_id: 'doctor_' + email.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''), name, email };
});
if (new Set(doctors.map((doctor) => doctor.email)).size !== doctors.length) throw new Error('Each doctor email must appear only once.');
const slug = campaignName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 48);
if (!slug) throw new Error('Campaign name must contain letters or numbers.');
const campaignId = 'campaign_' + month.replace('-', '') + '_' + slug;
const payload = { campaign_id: campaignId, campaign_name: campaignName, campaign_month: month + '-01', practice_name: practiceName, website_url: websiteUrl, topics, doctors };
return { json: { payload_json: JSON.stringify(payload), campaign_id: campaignId, doctor_count: doctors.length } };` },
    },
    bq('aac-store-campaign', 'Store campaign and invitees', `DECLARE p JSON DEFAULT PARSE_JSON(@payload);
DECLARE v_campaign_id STRING DEFAULT JSON_VALUE(p, '$.campaign_id');
DECLARE v_practice_id STRING;
ASSERT (
  SELECT COUNT(*) FROM \`apex-marketing-n8n.automated_article_creation.practices\`
  WHERE active = TRUE
    AND LOWER(TRIM(practice_name)) = LOWER(JSON_VALUE(p, '$.practice_name'))
    AND REGEXP_REPLACE(LOWER(TRIM(website_domain)), r'/$', '') = JSON_VALUE(p, '$.website_url')
) = 1 AS 'Location and website must match exactly one active, configured practice profile.';
SET v_practice_id = (
  SELECT practice_id FROM \`apex-marketing-n8n.automated_article_creation.practices\`
  WHERE active = TRUE
    AND LOWER(TRIM(practice_name)) = LOWER(JSON_VALUE(p, '$.practice_name'))
    AND REGEXP_REPLACE(LOWER(TRIM(website_domain)), r'/$', '') = JSON_VALUE(p, '$.website_url')
  LIMIT 1
);
ASSERT NOT EXISTS (
  SELECT 1 FROM \`apex-marketing-n8n.automated_article_creation.doctors\` d
  JOIN UNNEST(JSON_QUERY_ARRAY(p, '$.doctors')) AS doctor
    ON LOWER(d.email) = LOWER(JSON_VALUE(doctor, '$.email'))
  WHERE d.practice_id IS NOT NULL AND d.practice_id != v_practice_id
) AS 'A doctor is already mapped to a different location. Resolve the doctor-to-website mapping before launch.';
ASSERT NOT EXISTS (
  SELECT 1 FROM \`apex-marketing-n8n.automated_article_creation.doctors\` d
  JOIN UNNEST(JSON_QUERY_ARRAY(p, '$.doctors')) AS doctor
    ON LOWER(d.email) = LOWER(JSON_VALUE(doctor, '$.email'))
  WHERE d.doctor_id != JSON_VALUE(doctor, '$.doctor_id')
) AS 'A doctor email already uses a different profile ID. Reconcile duplicate doctor profiles before launch.';
ASSERT NOT EXISTS (SELECT 1 FROM \`apex-marketing-n8n.automated_article_creation.campaigns\` WHERE campaign_id = v_campaign_id) AS 'This campaign name and month have already been launched.';
ASSERT ARRAY_LENGTH(JSON_QUERY_ARRAY(p, '$.topics')) = 3 AS 'Exactly three topics are required.';
BEGIN TRANSACTION;
INSERT INTO \`apex-marketing-n8n.automated_article_creation.campaigns\`
(campaign_id, campaign_name, campaign_month, status, doctor_review_days, require_marketing_approval, created_at, launched_at)
VALUES (v_campaign_id, JSON_VALUE(p, '$.campaign_name'), DATE(JSON_VALUE(p, '$.campaign_month')), 'LAUNCHED', 5, TRUE, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP());
INSERT INTO \`apex-marketing-n8n.automated_article_creation.campaign_topics\`
(topic_id, campaign_id, topic_title, topic_description, interview_guidance, topic_sort_order, active, created_at)
SELECT CONCAT(v_campaign_id, '_topic_', CAST(sort_order AS STRING)), v_campaign_id, JSON_VALUE(topic), JSON_VALUE(topic), NULL, sort_order, TRUE, CURRENT_TIMESTAMP()
FROM UNNEST(JSON_QUERY_ARRAY(p, '$.topics')) AS topic WITH OFFSET AS zero_order
CROSS JOIN UNNEST([zero_order + 1]) AS sort_order;
MERGE \`apex-marketing-n8n.automated_article_creation.doctors\` T
USING (SELECT JSON_VALUE(doctor, '$.doctor_id') AS doctor_id, JSON_VALUE(doctor, '$.name') AS doctor_name, JSON_VALUE(doctor, '$.email') AS email
  FROM UNNEST(JSON_QUERY_ARRAY(p, '$.doctors')) AS doctor) S
ON T.doctor_id = S.doctor_id
WHEN MATCHED THEN UPDATE SET doctor_name = S.doctor_name, email = S.email, practice_id = v_practice_id, active = TRUE, updated_at = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN INSERT (doctor_id, doctor_name, email, practice_id, preferred_communication_channel, fallback_communication_channel, active, created_at, updated_at)
  VALUES (S.doctor_id, S.doctor_name, S.email, v_practice_id, 'email', 'email', TRUE, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP());
INSERT INTO \`apex-marketing-n8n.automated_article_creation.campaign_doctors\`
(campaign_id, doctor_id, status, invited_at, created_at, updated_at)
SELECT v_campaign_id, JSON_VALUE(doctor, '$.doctor_id'), 'READY', NULL, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()
FROM UNNEST(JSON_QUERY_ARRAY(p, '$.doctors')) AS doctor;
INSERT INTO \`apex-marketing-n8n.automated_article_creation.workflow_events\`
(event_id, entity_type, entity_id, event_type, event_timestamp, source_system, workflow_execution_id, payload)
VALUES (GENERATE_UUID(), 'campaign', v_campaign_id, 'campaign.started', CURRENT_TIMESTAMP(), 'n8n:campaign-form', NULL,
  TO_JSON(STRUCT(ARRAY_LENGTH(JSON_QUERY_ARRAY(p, '$.topics')) AS topic_count, ARRAY_LENGTH(JSON_QUERY_ARRAY(p, '$.doctors')) AS doctor_count)));
COMMIT TRANSACTION;
SELECT v_campaign_id AS campaign_id, 'LAUNCHED' AS status, ARRAY_LENGTH(JSON_QUERY_ARRAY(p, '$.doctors')) AS doctor_count;`, [0, 80], [
      { name: 'payload', value: '={{ $json.payload_json }}' },
    ]),
    {
      id: 'aac-campaign-form-notes', name: 'Campaign Launch Notes',
      type: 'n8n-nodes-base.stickyNote', typeVersion: 1, position: [-620, -340],
      parameters: { content: '## Campaign launch interface\n\nKeep this form inactive until real locations, websites, and doctor assignments are verified. A dedicated n8n Basic Auth credential is required. The entered location name and HTTPS website must match one active practice profile; existing doctors cannot be silently reassigned to another location. Each campaign currently targets one location and website. Workflow 02 sends invitations. A campaign name and month may be launched only once.', height: 280, width: 640 },
    },
  ],
  connections: {
    'Start a campaign': edge('Validate campaign details'),
    'Validate campaign details': edge('Store campaign and invitees'),
  },
  settings: { executionOrder: 'v1', timezone: 'America/Chicago' }, active: false, tags: [],
};
write('01-launch-campaign.json', launch);

const invite = {
  name: 'AAC - 02 - Dispatch Campaign Invitations',
  nodes: [
    {
      id: 'aac-invitation-schedule', name: 'Check for unsent invitations every five minutes',
      type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2, position: [-780, 40],
      parameters: { rule: { interval: [{ field: 'cronExpression', expression: '*/5 * * * *' }] } },
    },
    { id: 'aac-invitation-manual', name: 'Send next invitation manually', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1, position: [-780, 200], parameters: {} },
    bq('aac-create-invitation-links', 'Create three topic links', `UPDATE \`apex-marketing-n8n.automated_article_creation.campaign_doctors\` cd
SET status = 'INVITED', invited_at = COALESCE(invited_at, CURRENT_TIMESTAMP()), updated_at = CURRENT_TIMESTAMP()
WHERE status = 'READY' AND EXISTS (
  SELECT 1 FROM \`apex-marketing-n8n.automated_article_creation.communications\` cm
  WHERE cm.campaign_id = cd.campaign_id AND cm.doctor_id = cd.doctor_id
    AND cm.communication_type = 'CAMPAIGN_INVITATION' AND cm.status = 'SENT');
CREATE TEMP TABLE candidate AS
SELECT cd.campaign_id, cd.doctor_id, c.campaign_name, d.doctor_name
FROM \`apex-marketing-n8n.automated_article_creation.campaign_doctors\` cd
JOIN \`apex-marketing-n8n.automated_article_creation.campaigns\` c ON c.campaign_id = cd.campaign_id
JOIN \`apex-marketing-n8n.automated_article_creation.doctors\` d ON d.doctor_id = cd.doctor_id
WHERE cd.status = 'READY' AND c.status = 'LAUNCHED' AND d.active = TRUE
ORDER BY c.launched_at, cd.created_at, cd.doctor_id
LIMIT 1;
ASSERT NOT EXISTS (SELECT 1 FROM candidate c WHERE (SELECT COUNT(*) FROM \`apex-marketing-n8n.automated_article_creation.campaign_topics\` t WHERE t.campaign_id = c.campaign_id AND t.active = TRUE) != 3) AS 'Campaign needs exactly three active topics.';
UPDATE \`apex-marketing-n8n.automated_article_creation.interview_links\` il
SET status = 'SUPERSEDED'
WHERE status IN ('READY', 'OPENED') AND used_at IS NULL
  AND EXISTS (SELECT 1 FROM candidate c WHERE c.campaign_id = il.campaign_id AND c.doctor_id = il.doctor_id);
CREATE TEMP TABLE new_links AS
SELECT GENERATE_UUID() AS link_id, c.campaign_id, c.doctor_id, c.campaign_name, c.doctor_name,
  t.topic_id, t.topic_title, t.topic_sort_order,
  CONCAT(REPLACE(GENERATE_UUID(), '-', ''), REPLACE(GENERATE_UUID(), '-', '')) AS raw_token,
  TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL 30 DAY) AS expires_at
FROM candidate c JOIN \`apex-marketing-n8n.automated_article_creation.campaign_topics\` t
  ON t.campaign_id = c.campaign_id AND t.active = TRUE;
INSERT INTO \`apex-marketing-n8n.automated_article_creation.interview_links\`
(link_id, campaign_id, doctor_id, topic_id, secure_token_hash, status, created_at, expires_at, first_opened_at, used_at, interview_id)
SELECT link_id, campaign_id, doctor_id, topic_id, TO_HEX(SHA256(raw_token)), 'READY', CURRENT_TIMESTAMP(), expires_at, NULL, NULL, NULL
FROM new_links;
SELECT campaign_id, doctor_id, campaign_name, doctor_name, topic_title, topic_sort_order,
  CONCAT('https://apex-content-interviewer.jdold.workers.dev/interview/', raw_token) AS interview_url
FROM new_links ORDER BY topic_sort_order;`, [-500, 120]),
    {
      id: 'aac-compose-invitation', name: 'Compose three-topic invitation', type: 'n8n-nodes-base.code', typeVersion: 2, position: [-200, 120],
      parameters: { mode: 'runOnceForAllItems', jsCode: `const rows = $input.all().map((item) => item.json);
if (rows.length !== 3) throw new Error('Expected exactly three topic links.');
rows.sort((a, b) => Number(a.topic_sort_order) - Number(b.topic_sort_order));
const first = rows[0];
if (rows.some((row) => row.doctor_id !== first.doctor_id || row.campaign_id !== first.campaign_id)) throw new Error('Invitation rows span multiple doctors or campaigns.');
const lines = ['Hello ' + first.doctor_name + ',', '', 'We have three article topics for you to choose from. Pick the one you would most like to discuss, then use its secure link to start a voice interview:', ''];
for (const row of rows) lines.push(row.topic_sort_order + '. ' + row.topic_title, row.interview_url, '');
lines.push('These links expire in 30 days. Please do not include patient-identifying information in the interview.', '', 'Apex Dental Partners');
return [{ json: { doctor_id: first.doctor_id, article_id: '', campaign_id: first.campaign_id,
  communication_type: 'CAMPAIGN_INVITATION', subject: 'Choose your article topic: ' + first.campaign_name,
  message_text: lines.join(String.fromCharCode(10)), action_url: '' } }];` },
    },
    {
      id: 'aac-private-invitation-route', name: 'Send invitation through private router',
      type: 'n8n-nodes-base.executeWorkflow', typeVersion: 1.2, position: [80, 120],
      parameters: {
        workflowId: { __rl: true, value: 'cZtS9x6kbI46Q2Bi', mode: 'list', cachedResultName: 'AAC - 16 - Send Doctor Message' },
        workflowInputs: {
          mappingMode: 'defineBelow', value: Object.fromEntries(['doctor_id', 'article_id', 'campaign_id', 'communication_type', 'subject', 'message_text', 'action_url'].map((key) => [key, `={{ $json.${key} }}`])),
          matchingColumns: [], schema: ['doctor_id', 'article_id', 'campaign_id', 'communication_type', 'subject', 'message_text', 'action_url'].map((key) => ({ id: key, displayName: key, type: 'string' })),
          attemptToConvertTypes: false, convertFieldsToString: true,
        },
        options: { waitForSubWorkflow: true },
      },
    },
    {
      id: 'aac-confirm-invitation', name: 'Require successful delivery', type: 'n8n-nodes-base.code', typeVersion: 2, position: [360, 120],
      parameters: { mode: 'runOnceForEachItem', jsCode: `if ($json.success !== true && $json.status !== 'SENT') throw new Error('Doctor invitation was not delivered.');
const original = $('Compose three-topic invitation').first().json;
return { json: { campaign_id: original.campaign_id, doctor_id: original.doctor_id } };` },
    },
    bq('aac-record-invitation', 'Mark doctor invited', `UPDATE \`apex-marketing-n8n.automated_article_creation.campaign_doctors\`
SET status = 'INVITED', invited_at = CURRENT_TIMESTAMP(), updated_at = CURRENT_TIMESTAMP()
WHERE campaign_id = @campaign_id AND doctor_id = @doctor_id AND status = 'READY';
INSERT INTO \`apex-marketing-n8n.automated_article_creation.workflow_events\`
(event_id, entity_type, entity_id, event_type, event_timestamp, source_system, workflow_execution_id, payload)
VALUES (GENERATE_UUID(), 'campaign_doctor', CONCAT(@campaign_id, ':', @doctor_id), 'interview.invitation_sent', CURRENT_TIMESTAMP(), 'n8n', NULL, TO_JSON(STRUCT(@campaign_id AS campaign_id, @doctor_id AS doctor_id)));
SELECT @campaign_id AS campaign_id, @doctor_id AS doctor_id, 'INVITED' AS status;`, [640, 120], [
      { name: 'campaign_id', value: '={{ $json.campaign_id }}' }, { name: 'doctor_id', value: '={{ $json.doctor_id }}' },
    ]),
    {
      id: 'aac-invitation-notes', name: 'Invitation Notes', type: 'n8n-nodes-base.stickyNote', typeVersion: 1, position: [-780, -320],
      parameters: { content: '## Campaign invitation delivery\n\nEvery five minutes, take one READY doctor from a launched campaign, create three hashed one-time topic links, and send one email through the private doctor-message router. A successful communication makes the campaign doctor INVITED. Failures remain eligible for retry; old unused links are superseded.', height: 260, width: 640 },
    },
  ],
  connections: {
    'Check for unsent invitations every five minutes': edge('Create three topic links'),
    'Send next invitation manually': edge('Create three topic links'),
    'Create three topic links': edge('Compose three-topic invitation'),
    'Compose three-topic invitation': edge('Send invitation through private router'),
    'Send invitation through private router': edge('Require successful delivery'),
    'Require successful delivery': edge('Mark doctor invited'),
  },
  settings: { executionOrder: 'v1', timezone: 'America/Chicago' }, active: false, tags: [],
};
write('02-dispatch-campaign-invitations.json', invite);
