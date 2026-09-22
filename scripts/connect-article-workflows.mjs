import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const workflowDir = path.join(root, 'n8n');
const read = (name) => JSON.parse(fs.readFileSync(path.join(workflowDir, name), 'utf8'));
const write = (name, workflow) => fs.writeFileSync(path.join(workflowDir, name), `${JSON.stringify(workflow, null, 2)}\n`);
const connect = (workflow, from, to) => {
  workflow.connections[from] = { main: [[{ node: to, type: 'main', index: 0 }]] };
};
const addSchedule = (workflow, name, expression, target, position) => {
  workflow.nodes.push({
    parameters: { rule: { interval: [{ field: 'cronExpression', expression }] } },
    id: `aac-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name,
    type: 'n8n-nodes-base.scheduleTrigger',
    typeVersion: 1.2,
    position,
  });
  connect(workflow, name, target);
};

const generationName = '06-generate-article.json';
const generation = read(generationName);
if (!generation.nodes.some((node) => node.name === 'Check for Completed Interviews Hourly')) {
  addSchedule(generation, 'Check for Completed Interviews Hourly', '5 * * * *', 'Load Next Completed Interview', [-880, 240]);
}
write(generationName, generation);

const revisionName = '10-revise-article-from-doctor-feedback.json';
const revision = read(revisionName);
if (!revision.nodes.some((node) => node.name === 'Check for Doctor Change Requests Hourly')) {
  addSchedule(revision, 'Check for Doctor Change Requests Hourly', '10 * * * *', 'Load Requested Revision', [-920, 260]);
}
revision.nodes = revision.nodes.filter((node) => node.name !== 'Create Fresh Review Link');
delete revision.connections['Persist New Article Version'];
write(revisionName, revision);

const reviewName = '07-create-doctor-review-link.json';
const review = read(reviewName);
if (!review.nodes.some((node) => node.name === 'Check for Drafts Awaiting Review Hourly')) {
  addSchedule(review, 'Check for Drafts Awaiting Review Hourly', '20 * * * *', 'Generate and Store Secure Review Link', [-520, 160]);
}
const reviewNode = review.nodes.find((node) => node.name === 'Generate and Store Secure Review Link');
let sql = reviewNode.parameters.sqlQuery;
sql = sql.replace(
  "WHERE a.status = 'DOCTOR_REVIEW_PENDING'\nORDER BY a.created_at DESC",
  `WHERE a.status = 'DOCTOR_REVIEW_PENDING'
  AND NOT EXISTS (
    SELECT 1
    FROM \`apex-marketing-n8n.automated_article_creation.communications\` cm
    WHERE cm.article_id = a.article_id
      AND cm.communication_type IN ('DOCTOR_REVIEW_REQUEST', 'DOCTOR_REVISED_DRAFT')
      AND cm.status = 'SENT'
      AND cm.sent_at >= v.created_at
  )
ORDER BY v.created_at ASC`,
);
sql = sql.replace(
  'a.doctor_review_deadline,\n  d.doctor_name',
  'a.doctor_review_deadline, a.current_version,\n  d.doctor_name',
);
sql = sql.replace(
  'a.article_id, a.doctor_id, a.doctor_name, a.credentials, a.practice_name, a.article_title,',
  'a.article_id, a.doctor_id, a.campaign_id, a.current_version, a.doctor_name, a.credentials, a.practice_name, a.article_title,',
);
sql = sql.replace('https://content.apexdp.com/review/', 'https://apex-content-interviewer.jdold.workers.dev/review/');
reviewNode.parameters.sqlQuery = sql;

if (!review.nodes.some((node) => node.name === 'Prepare Doctor Review Message')) {
  review.nodes.push({
    parameters: {
      mode: 'runOnceForEachItem',
      jsCode: `const title = $json.article_title || 'your article';
const name = $json.doctor_name || 'Doctor';
const revised = Number($json.current_version) > 1;
return { json: {
  doctor_id: $json.doctor_id,
  article_id: $json.article_id,
  campaign_id: $json.campaign_id,
  communication_type: revised ? 'DOCTOR_REVISED_DRAFT' : 'DOCTOR_REVIEW_REQUEST',
  subject: revised ? 'Your revised article is ready for review' : 'Your article is ready for review',
  message_text: ['Hello ' + name + ',', '', (revised ? 'The revised article' : 'A draft article') + ' "' + title + '" is ready for your review. Please use the secure link below to approve it or request changes.', '', 'This review link expires at the review deadline.', '', 'Apex Dental Partners'].join('\\n'),
  action_url: $json.review_url,
} };`,
    },
    id: 'aac-prepare-doctor-review-message',
    name: 'Prepare Doctor Review Message',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [40, 0],
  });
  const router = read('17-doctor-review-reminders.json').nodes.find((node) => node.name === 'Call Private Doctor Message Router');
  review.nodes.push({
    ...structuredClone(router),
    id: 'aac-call-private-doctor-review-router',
    name: 'Send Doctor Review Invitation Privately',
    position: [320, 0],
  });
}
const messageNode = review.nodes.find((node) => node.name === 'Prepare Doctor Review Message');
messageNode.parameters.jsCode = messageNode.parameters.jsCode.replace(/\.join\('(?:\\\\n|\\n)'\)/, '.join(String.fromCharCode(10))');
connect(review, 'Generate and Store Secure Review Link', 'Prepare Doctor Review Message');
connect(review, 'Prepare Doctor Review Message', 'Send Doctor Review Invitation Privately');
write(reviewName, review);

const marketingRouteName = '12-route-to-marketing-review.json';
const marketingRoute = read(marketingRouteName);
if (!marketingRoute.nodes.some((node) => node.name === 'Check for Doctor-Approved Articles Hourly')) {
  addSchedule(marketingRoute, 'Check for Doctor-Approved Articles Hourly', '25 * * * *', 'Route Approved Article', [-520, 160]);
}
write(marketingRouteName, marketingRoute);

const marketingNoticeName = '18-send-marketing-review-invitation.json';
const marketingNotice = {
  name: 'AAC - 18 - Send Marketing Review Invitation',
  nodes: [
    {
      parameters: { rule: { interval: [{ field: 'cronExpression', expression: '30 * * * *' }] } },
      id: 'aac-marketing-invitation-schedule',
      name: 'Check for Unsent Marketing Reviews Hourly',
      type: 'n8n-nodes-base.scheduleTrigger',
      typeVersion: 1.2,
      position: [-720, 80],
    },
    {
      parameters: {},
      id: 'aac-marketing-invitation-manual',
      name: 'Run Marketing Invitation Check Manually',
      type: 'n8n-nodes-base.manualTrigger',
      typeVersion: 1,
      position: [-720, 240],
    },
    {
      parameters: {
        authentication: 'serviceAccount',
        projectId: { __rl: true, value: 'apex-marketing-n8n', mode: 'id' },
        sqlQuery: `-- Send one marketing review invitation for each pending article version.
CREATE TEMP TABLE candidate AS
SELECT a.article_id, a.current_version, ap.deadline,
  COALESCE(JSON_VALUE(v.content, '$.metadata.h1'), 'Article draft') AS article_title
FROM \`apex-marketing-n8n.automated_article_creation.articles\` a
JOIN \`apex-marketing-n8n.automated_article_creation.approvals\` ap
  ON ap.article_id = a.article_id AND ap.approval_type = 'MARKETING_REVIEW' AND ap.status = 'PENDING'
JOIN \`apex-marketing-n8n.automated_article_creation.article_versions\` v
  ON v.article_id = a.article_id AND v.version_number = a.current_version
WHERE a.status = 'MARKETING_REVIEW'
  AND COALESCE(ap.deadline, TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)) > CURRENT_TIMESTAMP()
  AND NOT EXISTS (
    SELECT 1 FROM \`apex-marketing-n8n.automated_article_creation.workflow_events\` e
    WHERE e.entity_type = 'article' AND e.entity_id = a.article_id
      AND e.event_type = 'marketing.review_invitation_sent'
      AND SAFE_CAST(JSON_VALUE(e.payload, '$.version_number') AS INT64) = a.current_version
  )
ORDER BY ap.requested_at ASC
LIMIT 1;

UPDATE \`apex-marketing-n8n.automated_article_creation.marketing_review_links\`
SET status = 'SUPERSEDED'
WHERE article_id IN (SELECT article_id FROM candidate) AND status IN ('READY', 'OPENED');

CREATE TEMP TABLE new_link AS
SELECT GENERATE_UUID() AS marketing_review_link_id, article_id, current_version, article_title,
  CONCAT(REPLACE(GENERATE_UUID(), '-', ''), REPLACE(GENERATE_UUID(), '-', '')) AS raw_token,
  COALESCE(deadline, TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)) AS expires_at
FROM candidate;

INSERT INTO \`apex-marketing-n8n.automated_article_creation.marketing_review_links\`
(marketing_review_link_id, article_id, secure_token_hash, status, created_at, expires_at)
SELECT marketing_review_link_id, article_id, TO_HEX(SHA256(raw_token)), 'READY', CURRENT_TIMESTAMP(), expires_at
FROM new_link;

SELECT article_id, current_version, article_title, marketing_review_link_id,
  CONCAT('https://apex-content-interviewer.jdold.workers.dev/marketing-review/', raw_token) AS review_url
FROM new_link;`,
        options: { location: 'US' },
      },
      id: 'aac-marketing-invitation-link',
      name: 'Prepare Fresh Marketing Review Link',
      type: 'n8n-nodes-base.googleBigQuery',
      typeVersion: 2.1,
      position: [-440, 160],
    },
    {
      parameters: {
        mode: 'runOnceForEachItem',
        jsCode: `return { json: {
  article_id: $json.article_id,
  current_version: $json.current_version,
  recipient: 'jdold@apexdp.com',
  subject: 'Article ready for marketing review',
  message_text: ['An article is ready for marketing review:', '', $json.article_title || 'Article draft', '', 'Approve it or request changes using this secure link:', $json.review_url, '', 'Apex Dental Partners'].join(String.fromCharCode(10)),
} };`,
      },
      id: 'aac-marketing-invitation-message',
      name: 'Prepare Marketing Review Email',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [-160, 160],
    },
    {
      parameters: {
        sendTo: '={{ $json.recipient }}',
        subject: '={{ $json.subject }}',
        emailType: 'text',
        message: '={{ $json.message_text }}',
        options: {},
      },
      id: 'aac-marketing-invitation-gmail',
      name: 'Email Marketing Reviewer',
      type: 'n8n-nodes-base.gmail',
      typeVersion: 2.1,
      position: [120, 160],
    },
    {
      parameters: {
        authentication: 'serviceAccount',
        projectId: { __rl: true, value: 'apex-marketing-n8n', mode: 'id' },
        sqlQuery: `INSERT INTO \`apex-marketing-n8n.automated_article_creation.workflow_events\`
(event_id, entity_type, entity_id, event_type, event_timestamp, source_system, workflow_execution_id, payload)
VALUES (GENERATE_UUID(), 'article', @article_id, 'marketing.review_invitation_sent', CURRENT_TIMESTAMP(),
  'n8n:gmail', NULL, TO_JSON(STRUCT(CAST(@version_number AS INT64) AS version_number,
  @recipient AS recipient, NULLIF(@provider_message_id, '') AS provider_message_id)));
SELECT @article_id AS article_id, 'SENT' AS status;`,
        options: {
          location: 'US',
          queryParameters: { namedParameters: [
            { name: 'article_id', value: "={{ $('Prepare Marketing Review Email').item.json.article_id }}" },
            { name: 'version_number', value: "={{ $('Prepare Marketing Review Email').item.json.current_version }}" },
            { name: 'recipient', value: "={{ $('Prepare Marketing Review Email').item.json.recipient }}" },
            { name: 'provider_message_id', value: "={{ $json.id || $json.messageId || '' }}" },
          ] },
        },
      },
      id: 'aac-marketing-invitation-log',
      name: 'Record Marketing Invitation Delivery',
      type: 'n8n-nodes-base.googleBigQuery',
      typeVersion: 2.1,
      position: [400, 160],
    },
    {
      parameters: {
        content: '## AAC Phase 1L - Marketing invitation\n\nAt minute 30 each hour, find one marketing review that has no successful email for its current article version. Rotate its secure link, email the designated Apex reviewer, then record successful delivery. A failed send remains eligible for a later retry. Static-site publication remains a separate step.',
        height: 300,
        width: 600,
      },
      id: 'aac-marketing-invitation-notes',
      name: 'Marketing Invitation Notes',
      type: 'n8n-nodes-base.stickyNote',
      typeVersion: 1,
      position: [-720, -300],
    },
  ],
  connections: {},
  pinData: {},
  settings: { executionOrder: 'v1' },
  active: false,
  tags: [],
};
connect(marketingNotice, 'Check for Unsent Marketing Reviews Hourly', 'Prepare Fresh Marketing Review Link');
connect(marketingNotice, 'Run Marketing Invitation Check Manually', 'Prepare Fresh Marketing Review Link');
connect(marketingNotice, 'Prepare Fresh Marketing Review Link', 'Prepare Marketing Review Email');
connect(marketingNotice, 'Prepare Marketing Review Email', 'Email Marketing Reviewer');
connect(marketingNotice, 'Email Marketing Reviewer', 'Record Marketing Invitation Delivery');
write(marketingNoticeName, marketingNotice);
