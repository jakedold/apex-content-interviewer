import { readFileSync, writeFileSync } from 'node:fs';

const load = (path) => JSON.parse(readFileSync(path, 'utf8'));
const save = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
const publisherPath = 'n8n/15-publish-approved-article-to-wordpress.json';
const decisionPath = 'n8n/14-record-marketing-review-response.json';
const publisher = load(publisherPath);
const decision = load(decisionPath);

const query = `-- TEST-1 only. Select the exact article approved by marketing.
CREATE TABLE IF NOT EXISTS \`apex-marketing-n8n.automated_article_creation.publication_records\` (
  publication_id STRING NOT NULL, article_id STRING NOT NULL, version_number INT64 NOT NULL,
  publisher_type STRING NOT NULL, publisher_config_reference STRING, external_post_id STRING,
  status STRING NOT NULL, requested_at TIMESTAMP NOT NULL, published_at TIMESTAMP,
  published_url STRING, last_error STRING
);
SELECT a.article_id, a.interview_id, a.doctor_id, a.practice_id, a.campaign_id,
  a.status AS article_status, a.current_version, d.doctor_name, d.credentials,
  p.practice_name, p.website_domain, p.publisher_type, p.publisher_config_reference,
  v.content AS publication_package_json
FROM \`apex-marketing-n8n.automated_article_creation.articles\` a
JOIN \`apex-marketing-n8n.automated_article_creation.article_versions\` v
  ON v.article_id = a.article_id AND v.version_number = a.current_version
JOIN \`apex-marketing-n8n.automated_article_creation.doctors\` d ON d.doctor_id = a.doctor_id
JOIN \`apex-marketing-n8n.automated_article_creation.practices\` p ON p.practice_id = a.practice_id
LEFT JOIN \`apex-marketing-n8n.automated_article_creation.publication_records\` pr
  ON pr.article_id = a.article_id AND pr.version_number = a.current_version
  AND pr.publisher_type = 'WORDPRESS' AND pr.status = 'PUBLISHED'
WHERE a.article_id = @article_id
  AND a.status = 'MARKETING_APPROVED'
  AND a.published_at IS NULL AND pr.article_id IS NULL
  AND a.practice_id = 'practice_test_001'
  AND UPPER(COALESCE(p.publisher_type, '')) = 'WORDPRESS'
  AND NULLIF(TRIM(p.publisher_config_reference), '') IS NOT NULL
  AND NULLIF(TRIM(p.website_domain), '') IS NOT NULL
LIMIT 1;`;

const loadArticle = publisher.nodes.find((node) => node.name === 'Load Approved WordPress Article');
loadArticle.parameters.sqlQuery = query;
loadArticle.parameters.options.queryParameters = {
  namedParameters: [{ name: 'article_id', value: '={{ $json.article_id }}' }],
};

const prepare = publisher.nodes.find((node) => node.name === 'Prepare WordPress Publication');
prepare.parameters.jsCode = prepare.parameters.jsCode.replace(
  "'{{PRACTICE_NAME}}': row.practice_name || ''",
  "'{{PRACTICE_NAME}}': '[sc name=\"practice_name\"][/sc]'",
);
prepare.parameters.jsCode = prepare.parameters.jsCode.replace(
  "const wordpressBaseUrl = requireHttpsUrl(config.wordpress_base_url, 'WordPress subsite base');",
  "const wordpressBaseUrl = requireHttpsUrl(config.wordpress_base_url, 'WordPress subsite base');\nif (row.practice_id !== 'practice_test_001' || wordpressBaseUrl !== 'https://apexparent.hostmanpowered.com/test001') {\n  throw new Error('Automatic publication is restricted to the TEST-1 WordPress subsite.');\n}",
);

if (!publisher.nodes.some((node) => node.name === 'When Executed by Another Workflow')) publisher.nodes.push({
  parameters: { workflowInputs: { values: [{ name: 'article_id' }] } },
  type: 'n8n-nodes-base.executeWorkflowTrigger', typeVersion: 1.1,
  position: [-760, 280], id: 'ae7200a4-b781-4a84-bb28-c7c84747ee34',
  name: 'When Executed by Another Workflow',
});
publisher.connections['When Executed by Another Workflow'] = {
  main: [[{ node: 'Load Approved WordPress Article', type: 'main', index: 0 }]],
};

if (!decision.nodes.some((node) => node.name === 'If Approved')) decision.nodes.push({
  parameters: {
    conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
      conditions: [{ id: 'marketing-approved-only', leftValue: '={{ $json.status }}',
        rightValue: 'APPROVED', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' },
    options: {},
  },
  type: 'n8n-nodes-base.if', typeVersion: 2.2,
  position: [80, 100], id: '6b358b53-64ea-4913-8008-4ab0ac2b5f14', name: 'If Approved',
});
if (!decision.nodes.some((node) => node.name === 'Publish Approved TEST-1 Article')) decision.nodes.push({
  parameters: {
    workflowId: { __rl: true, value: 'kGd2YSJ2MVJwRld0', mode: 'list',
      cachedResultName: 'AAC - 15 - Publish Approved Article to WordPress' },
    workflowInputs: { mappingMode: 'defineBelow', value: { article_id: '={{ $json.article_id }}' },
      matchingColumns: [], schema: [{ id: 'article_id', displayName: 'article_id', type: 'string' }],
      attemptToConvertTypes: false, convertFieldsToString: true },
    options: { waitForSubWorkflow: true },
  },
  type: 'n8n-nodes-base.executeWorkflow', typeVersion: 1.3,
  position: [320, 20], id: '47ed5b1a-c37d-4ef3-8c8c-827dee8a53f1',
  name: 'Publish Approved TEST-1 Article',
});
decision.connections['Return Marketing Decision'] = {
  main: [[{ node: 'If Approved', type: 'main', index: 0 }]],
};
decision.connections['If Approved'] = {
  main: [[{ node: 'Publish Approved TEST-1 Article', type: 'main', index: 0 }], []],
};

save(publisherPath, publisher);
save(decisionPath, decision);
