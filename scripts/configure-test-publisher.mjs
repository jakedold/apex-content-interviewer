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
CREATE TABLE IF NOT EXISTS \`apex-marketing-n8n.automated_article_creation.doctor_profiles\` (
  doctor_id STRING NOT NULL, practice_id STRING NOT NULL, work_email STRING,
  doctor_name STRING, credentials STRING, location_code STRING, profile_url STRING, photo_url STRING, short_bio STRING,
  source STRING, verified_at TIMESTAMP, active BOOL
);
ALTER TABLE \`apex-marketing-n8n.automated_article_creation.doctor_profiles\`
  ADD COLUMN IF NOT EXISTS credentials STRING;
SELECT LOWER(@qa_republish) = 'true' AS qa_republish,
  a.article_id, a.interview_id, a.doctor_id, a.practice_id, a.campaign_id,
  a.status AS article_status, a.current_version,
  COALESCE(NULLIF(TRIM(dp.doctor_name), ''), d.doctor_name) AS doctor_name,
  COALESCE(NULLIF(TRIM(dp.credentials), ''), d.credentials) AS credentials,
  LOWER(d.email) AS doctor_email,
  p.practice_name, p.website_domain, p.publisher_type, p.publisher_config_reference,
  dp.profile_url AS doctor_profile_url, dp.photo_url AS doctor_photo_url,
  dp.short_bio AS doctor_short_bio, dp.source AS doctor_profile_source,
  dp.verified_at AS doctor_profile_verified_at,
  t.topic_id, t.featured_image_source_url, t.featured_image_alt_text,
  t.featured_image_source_type, t.featured_image_rights_reference,
  v.content AS publication_package_json
FROM \`apex-marketing-n8n.automated_article_creation.articles\` a
JOIN \`apex-marketing-n8n.automated_article_creation.article_versions\` v
  ON v.article_id = a.article_id AND v.version_number = a.current_version
JOIN \`apex-marketing-n8n.automated_article_creation.interviews\` i ON i.interview_id = a.interview_id
JOIN \`apex-marketing-n8n.automated_article_creation.campaign_topics\` t ON t.topic_id = i.topic_id
JOIN \`apex-marketing-n8n.automated_article_creation.doctors\` d ON d.doctor_id = a.doctor_id
JOIN \`apex-marketing-n8n.automated_article_creation.practices\` p ON p.practice_id = a.practice_id
LEFT JOIN \`apex-marketing-n8n.automated_article_creation.doctor_profiles\` dp
  ON dp.doctor_id = a.doctor_id AND dp.practice_id = a.practice_id AND dp.active = TRUE
LEFT JOIN \`apex-marketing-n8n.automated_article_creation.publication_records\` pr
  ON pr.article_id = a.article_id AND pr.version_number = a.current_version
  AND pr.publisher_type = 'WORDPRESS' AND pr.status = 'PUBLISHED'
WHERE a.article_id = @article_id
  AND (
    (
      LOWER(@qa_republish) != 'true'
      AND a.status = 'MARKETING_APPROVED'
      AND a.published_at IS NULL
      AND pr.article_id IS NULL
    )
    OR (
      LOWER(@qa_republish) = 'true'
      AND a.article_id = 'article_6296aabf938f492eafd5a2b010b3f8c9'
      AND a.campaign_id = 'campaign_test_202609_aac_prestonwood_pilot_2026_09_23'
      AND a.status = 'PUBLISHED'
      AND a.published_at IS NOT NULL
      AND pr.external_post_id = '9988'
      AND LOWER(d.email) = 'jdold@apexdp.com'
    )
  )
  AND a.practice_id = 'practice_test_001'
  AND UPPER(COALESCE(p.publisher_type, '')) = 'WORDPRESS'
  AND NULLIF(TRIM(p.publisher_config_reference), '') IS NOT NULL
  AND NULLIF(TRIM(p.website_domain), '') IS NOT NULL
LIMIT 1;`;

const loadArticle = publisher.nodes.find((node) => node.name === 'Load Approved WordPress Article');
loadArticle.parameters.sqlQuery = query;
loadArticle.parameters.options.queryParameters = {
  namedParameters: [
    { name: 'article_id', value: '={{ $json.article_id }}' },
    { name: 'qa_republish', value: '={{ String($json.qa_republish ?? false) }}' },
  ],
};

const prepare = publisher.nodes.find((node) => node.name === 'Prepare WordPress Publication');
if (!prepare.parameters.jsCode.includes('leadingByline')) {
  prepare.parameters.jsCode = prepare.parameters.jsCode.replace(
    "html = html.replace(/<p\\b[^>]*class=[\"'][^\"']*\\barticle-byline\\b[^\"']*[\"'][^>]*>[\\s\\S]*?<\\/p>\\s*/gi, '');\nhtml = '<p class=\"article-byline\">By <strong>' + escapeHtml(doctorLabel) + '</strong></p>\\n' + html;",
    `html = html.replace(/<p\\b[^>]*class=["'][^"']*\\barticle-byline\\b[^"']*["'][^>]*>[\\s\\S]*?<\\/p>\\s*/gi, '');
const leadingByline = /^\\s*<p\\b[^>]*>([\\s\\S]*?)<\\/p>\\s*/i.exec(html);
if (leadingByline) {
  const leadingBylineText = leadingByline[1]
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\\s+/g, ' ')
    .trim();
  if (leadingBylineText.toLowerCase() === ('By ' + doctorLabel).toLowerCase()) {
    html = html.slice(leadingByline[0].length);
  }
}
html = '<p class="article-byline">By <strong>' + escapeHtml(doctorLabel) + '</strong></p>\\n' + html;`,
  );
}
prepare.parameters.jsCode = prepare.parameters.jsCode.replace(
  "'{{PRACTICE_NAME}}': row.practice_name || ''",
  "'{{PRACTICE_NAME}}': '[sc name=\"practice_name\"][/sc]'",
);
prepare.parameters.jsCode = prepare.parameters.jsCode.replace(
  'Automatic publication is restricted to the TEST-1 WordPress subsite.',
  'Automatic publication is restricted to the TEST-1 practice and its verified WordPress subsite.',
);
if (!prepare.parameters.jsCode.includes("if (row.practice_id !== 'practice_test_001'")) {
  prepare.parameters.jsCode = prepare.parameters.jsCode.replace(
    "const wordpressBaseUrl = requireHttpsUrl(config.wordpress_base_url, 'WordPress subsite base');",
    "const wordpressBaseUrl = requireHttpsUrl(config.wordpress_base_url, 'WordPress subsite base');\nif (row.practice_id !== 'practice_test_001' || wordpressBaseUrl !== 'https://apexparent.hostmanpowered.com/test001') {\n  throw new Error('Automatic publication is restricted to the TEST-1 practice and its verified WordPress subsite.');\n}",
  );
}
prepare.parameters.jsCode = prepare.parameters.jsCode.replace(
  'const exactPilotQa = row.qa_republish === true',
  "const exactPilotQa = String(row.qa_republish).toLowerCase() === 'true'",
);
prepare.parameters.jsCode = prepare.parameters.jsCode.replace(
  `const title = String(metadata.h1 || '').trim() || String(publicationPackage.article_html).match(/<h1[^>]*>([\\s\\S]*?)<\\/h1>/i)?.[1]?.replace(/<[^>]+>/g, '').trim();
const slug = String(metadata.slug || '').trim();
const seoTitle = String(metadata.seo_title || '').trim();
const excerpt = String(metadata.meta_description || '').trim();
const focusKeyphrase = String(metadata.focus_keyphrase || '').trim();`,
  `const exactPilotQa = String(row.qa_republish).toLowerCase() === 'true'
  && row.article_id === 'article_6296aabf938f492eafd5a2b010b3f8c9'
  && row.campaign_id === 'campaign_test_202609_aac_prestonwood_pilot_2026_09_23';
let title = String(metadata.h1 || '').trim() || String(publicationPackage.article_html).match(/<h1[^>]*>([\\s\\S]*?)<\\/h1>/i)?.[1]?.replace(/<[^>]+>/g, '').trim();
let slug = String(metadata.slug || '').trim();
let seoTitle = String(metadata.seo_title || '').trim();
let excerpt = String(metadata.meta_description || '').trim();
let focusKeyphrase = String(metadata.focus_keyphrase || '').trim();
if (!focusKeyphrase && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  const slugWords = slug.split('-').filter(Boolean);
  if (slugWords.length >= 2 && slugWords.length <= 6) focusKeyphrase = slugWords.join(' ');
}
if (exactPilotQa) {
  title ||= 'Two Dental Cleanings a Year: Too Many, Too Few, or Just Right?';
  slug ||= 'do-you-need-two-dental-cleanings-a-year';
  seoTitle ||= 'How Often Do You Need Dental Cleanings? | Prestonwood';
  excerpt ||= 'Learn how dentists personalize cleaning schedules based on gum health, cavity risk, tartar buildup, and each patient’s preventive care needs.';
  focusKeyphrase ||= 'dental cleaning frequency';
}`,
);
prepare.parameters.jsCode = prepare.parameters.jsCode.replace(
  "let focusKeyphrase = String(metadata.focus_keyphrase || '').trim();\nif (exactPilotQa) {",
  `let focusKeyphrase = String(metadata.focus_keyphrase || '').trim();
if (!focusKeyphrase && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  const slugWords = slug.split('-').filter(Boolean);
  if (slugWords.length >= 2 && slugWords.length <= 6) focusKeyphrase = slugWords.join(' ');
}
if (exactPilotQa) {`,
);

if (!publisher.nodes.some((node) => node.name === 'When Executed by Another Workflow')) publisher.nodes.push({
  parameters: { workflowInputs: { values: [{ name: 'article_id' }, { name: 'qa_republish', type: 'boolean' }] } },
  type: 'n8n-nodes-base.executeWorkflowTrigger', typeVersion: 1.1,
  position: [-760, 280], id: 'ae7200a4-b781-4a84-bb28-c7c84747ee34',
  name: 'When Executed by Another Workflow',
});
const subworkflowTrigger = publisher.nodes.find((node) => node.name === 'When Executed by Another Workflow');
subworkflowTrigger.parameters.workflowInputs = {
  values: [{ name: 'article_id' }, { name: 'qa_republish', type: 'boolean' }],
};
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
    workflowId: { __rl: true, value: 'IAZwCVXtPGN97BnC', mode: 'list',
      cachedResultName: 'AAC - 15 - Publish Approved Article to WordPress (Revised v2)' },
    workflowInputs: { mappingMode: 'defineBelow', value: { article_id: '={{ $json.article_id }}', qa_republish: false },
      matchingColumns: [], schema: [
        { id: 'article_id', displayName: 'article_id', type: 'string' },
        { id: 'qa_republish', displayName: 'qa_republish', type: 'boolean' },
      ],
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
