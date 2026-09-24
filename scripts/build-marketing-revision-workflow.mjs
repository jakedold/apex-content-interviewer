import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const source = JSON.parse(readFileSync('n8n/10-revise-article-from-doctor-feedback.json', 'utf8'));
const prompt = readFileSync('prompts/marketing-revision-master-prompt.md', 'utf8');
const workflow = structuredClone(source);
workflow.name = 'AAC - 20 - Revise Article from Marketing Feedback';
workflow.active = false;
workflow.versionId = randomUUID();
workflow.nodes.forEach((node) => { node.id = randomUUID(); });

function rename(oldName, newName) {
  const selected = workflow.nodes.find((node) => node.name === oldName);
  if (!selected) throw new Error(`Missing source node ${oldName}`);
  selected.name = newName;
  if (workflow.connections[oldName]) {
    workflow.connections[newName] = workflow.connections[oldName];
    delete workflow.connections[oldName];
  }
  for (const sourceConnections of Object.values(workflow.connections)) {
    for (const branch of sourceConnections?.main ?? []) {
      for (const connection of branch) if (connection.node === oldName) connection.node = newName;
    }
  }
  return selected;
}

rename('Run Doctor Revision Test', 'Run Marketing Revision Test');
const load = rename('Load Requested Revision', 'Load Marketing Revision Request');
const prepare = rename('Prepare Revision Request', 'Prepare Marketing Revision Request');
rename('Revise Article with OpenAI', 'Revise Article for Marketing');
const validate = rename('Validate Revised Package', 'Validate Marketing Revision');
const persist = rename('Persist New Article Version', 'Persist Marketing Revision');
const send = rename('Send Revised Draft for Doctor Review', 'Send Revised Draft for Marketing Review');
rename('Phase 1G Notes', 'Marketing Revision Notes');
rename('Check for Doctor Change Requests Hourly (Deactivated)', 'Marketing Revision Schedule (Deactivated)');

load.parameters.sqlQuery = load.parameters.sqlQuery
  .replace("approval_type = 'DOCTOR_REVIEW'", "approval_type = 'MARKETING_REVIEW'")
  .replace("a.status = 'DOCTOR_CHANGES_REQUESTED'", "a.status = 'MARKETING_CHANGES_REQUESTED'")
  .replace('newest unprocessed doctor revision request', 'newest unprocessed marketing revision request');

prepare.parameters.jsCode = prepare.parameters.jsCode
  .replace('DOCTOR REVISION REQUEST', 'MARKETING REVISION REQUEST')
  .replace('No unprocessed doctor revision request is available.', 'No unprocessed marketing revision request is available.')
  .replace("$('Prepare Revision Request')", "$('Prepare Marketing Revision Request')");
const instructionsAnchor = /instructions: ("(?:\\.|[^"\\])*"),\n      input,/;
const match = prepare.parameters.jsCode.match(instructionsAnchor);
if (!match) throw new Error('Marketing revision prompt anchor is missing');
prepare.parameters.jsCode = prepare.parameters.jsCode.replace(instructionsAnchor, `instructions: ${JSON.stringify(prompt)},\n      input,`);

validate.parameters.jsCode = validate.parameters.jsCode.replace(
  "$('Prepare Revision Request')",
  "$('Prepare Marketing Revision Request')",
);

persist.parameters.sqlQuery = `-- Preserve the approved doctor version, create a distinct marketing revision, and return it to marketing only.
ASSERT (
  SELECT COUNT(*) FROM \`apex-marketing-n8n.automated_article_creation.articles\`
  WHERE article_id = @article_id AND status = 'MARKETING_CHANGES_REQUESTED'
    AND current_version = CAST(@current_version AS INT64)
) = 1 AS 'The marketing change request was already processed or its version changed.';

MERGE \`apex-marketing-n8n.automated_article_creation.article_versions\` T
USING (SELECT @article_id AS article_id, CAST(@next_version AS INT64) AS version_number,
  'AI_MARKETING_REVISION' AS version_type, @package_json AS content,
  @revision_instruction AS revision_instruction, CURRENT_TIMESTAMP() AS created_at,
  'n8n:marketing-revision' AS created_by) S
ON T.article_id = S.article_id AND T.version_number = S.version_number
WHEN NOT MATCHED THEN INSERT
  (article_id, version_number, version_type, content, revision_instruction, created_at, created_by)
VALUES (S.article_id, S.version_number, S.version_type, S.content, S.revision_instruction, S.created_at, S.created_by);

UPDATE \`apex-marketing-n8n.automated_article_creation.articles\`
SET status = 'MARKETING_REVIEW', current_version = CAST(@next_version AS INT64),
  marketing_approved_at = NULL
WHERE article_id = @article_id AND status = 'MARKETING_CHANGES_REQUESTED'
  AND current_version = CAST(@current_version AS INT64);

UPDATE \`apex-marketing-n8n.automated_article_creation.campaign_doctors\`
SET status = 'MARKETING_REVIEW', updated_at = CURRENT_TIMESTAMP()
WHERE campaign_id = @campaign_id AND doctor_id = @doctor_id;

INSERT INTO \`apex-marketing-n8n.automated_article_creation.approvals\`
(approval_id, article_id, approval_type, status, requested_at, deadline)
VALUES (GENERATE_UUID(), @article_id, 'MARKETING_REVIEW', 'PENDING',
  CURRENT_TIMESTAMP(), TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL 30 DAY));

INSERT INTO \`apex-marketing-n8n.automated_article_creation.workflow_events\`
(event_id, entity_type, entity_id, event_type, event_timestamp, source_system, workflow_execution_id, payload)
VALUES (GENERATE_UUID(), 'article', @article_id, 'article.revised', CURRENT_TIMESTAMP(),
  'n8n+openai', NULL, TO_JSON(STRUCT(CAST(@current_version AS INT64) AS previous_version,
  CAST(@next_version AS INT64) AS version_number, 'AI_MARKETING_REVISION' AS version_type,
  @approval_id AS approval_id, @openai_response_id AS openai_response_id)));

SELECT @article_id AS article_id, @doctor_id AS doctor_id, @campaign_id AS campaign_id,
  CAST(@next_version AS INT64) AS current_version, 'MARKETING_REVIEW' AS status;`;
persist.parameters.options.queryParameters.namedParameters = persist.parameters.options.queryParameters.namedParameters.filter(
  ({ name }) => name !== 'doctor_review_days' && name !== 'interview_id',
);

send.parameters.workflowId.value = 'L6fSarhGYhUmogmE';
send.parameters.workflowId.cachedResultName = 'AAC - 18 - Send Marketing Review Invitation';

const note = workflow.nodes.find((node) => node.name === 'Marketing Revision Notes');
note.parameters.content = 'Marketing change request → new immutable AI_MARKETING_REVISION → fresh marketing approval → marketing invitation. The doctor is not re-asked. Only the exact TEST001 article selected by the caller may run. WordPress publishing remains behind a new marketing approval.';

writeFileSync('n8n/20-revise-article-from-marketing-feedback.json', `${JSON.stringify(workflow, null, 2)}\n`);
