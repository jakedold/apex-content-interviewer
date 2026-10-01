import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const workflowDir = path.join(root, 'n8n');

const readWorkflow = (name) => JSON.parse(fs.readFileSync(path.join(workflowDir, name), 'utf8'));
const writeWorkflow = (name, workflow) => {
  fs.writeFileSync(path.join(workflowDir, name), `${JSON.stringify(workflow, null, 2)}\n`);
};
const nodeByName = (workflow, name) => {
  const node = workflow.nodes.find((candidate) => candidate.name === name);
  if (!node) throw new Error(`Missing node "${name}" in ${workflow.name}.`);
  return node;
};
const replaceOnce = (value, before, after, label) => {
  if (value.includes(after)) return value;
  const matches = value.split(before).length - 1;
  if (matches !== 1) throw new Error(`${label}: expected one source match, found ${matches}.`);
  return value.replace(before, after);
};

const verifiedPracticeGuard = `p.active = TRUE
  AND UPPER(COALESCE(p.publisher_type, '')) = 'WORDPRESS'
  AND NULLIF(TRIM(p.website_domain), '') IS NOT NULL
  AND NULLIF(TRIM(JSON_VALUE(SAFE.PARSE_JSON(p.publisher_config_reference), '$.wordpress_base_url')), '') IS NOT NULL
  AND NULLIF(TRIM(JSON_VALUE(SAFE.PARSE_JSON(p.publisher_config_reference), '$.credential_name')), '') IS NOT NULL
  AND (
    p.practice_id = 'practice_test_001'
    OR UPPER(COALESCE(JSON_VALUE(SAFE.PARSE_JSON(p.publisher_config_reference), '$.mapping_status'), '')) = 'VERIFIED'
  )`;

const directReplacements = [
  ['06-generate-article.json', 'Load Next Completed Interview', "  AND d.practice_id = 'practice_test_001'"],
  ['07-create-doctor-review-link.json', 'Generate and Store Secure Review Link', "  AND a.practice_id = 'practice_test_001'"],
  ['10-revise-article-from-doctor-feedback.json', 'Load Requested Revision', "  AND a.practice_id = 'practice_test_001'"],
  ['20-revise-article-from-marketing-feedback.json', 'Load Marketing Revision Request', "  AND a.practice_id = 'practice_test_001'"],
];

for (const [file, nodeName, before] of directReplacements) {
  const workflow = readWorkflow(file);
  const node = nodeByName(workflow, nodeName);
  node.parameters.sqlQuery = replaceOnce(
    node.parameters.sqlQuery,
    before,
    `  AND ${verifiedPracticeGuard}`,
    `${file}/${nodeName}`,
  );
  writeWorkflow(file, workflow);
}

{
  const file = '12-route-to-marketing-review.json';
  const workflow = readWorkflow(file);
  const node = nodeByName(workflow, 'Route Approved Article');
  node.parameters.sqlQuery = replaceOnce(
    node.parameters.sqlQuery,
    "JOIN `apex-marketing-n8n.automated_article_creation.campaigns` c ON c.campaign_id = a.campaign_id\nWHERE",
    "JOIN `apex-marketing-n8n.automated_article_creation.campaigns` c ON c.campaign_id = a.campaign_id\nJOIN `apex-marketing-n8n.automated_article_creation.practices` p ON p.practice_id = a.practice_id\nWHERE",
    `${file}/join practice`,
  );
  node.parameters.sqlQuery = replaceOnce(
    node.parameters.sqlQuery,
    "  AND a.practice_id = 'practice_test_001'",
    `  AND ${verifiedPracticeGuard}`,
    `${file}/verified practice guard`,
  );
  writeWorkflow(file, workflow);
}

{
  const file = '18-send-marketing-review-invitation.json';
  const workflow = readWorkflow(file);
  const node = nodeByName(workflow, 'Prepare Fresh Marketing Review Link');
  node.parameters.sqlQuery = replaceOnce(
    node.parameters.sqlQuery,
    "JOIN `apex-marketing-n8n.automated_article_creation.doctors` d ON d.doctor_id = a.doctor_id\nJOIN",
    "JOIN `apex-marketing-n8n.automated_article_creation.doctors` d ON d.doctor_id = a.doctor_id\nJOIN `apex-marketing-n8n.automated_article_creation.practices` p ON p.practice_id = a.practice_id\nJOIN",
    `${file}/join practice`,
  );
  node.parameters.sqlQuery = replaceOnce(
    node.parameters.sqlQuery,
    "  AND a.practice_id = 'practice_test_001'",
    `  AND ${verifiedPracticeGuard}`,
    `${file}/verified practice guard`,
  );
  writeWorkflow(file, workflow);
}

console.log('Verified-practice workflow guards are configured.');
