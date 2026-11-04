import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const worker = read('worker/index.ts');
const admin = read('worker/admin.ts');
const client = read('src/admin.ts');
const router = JSON.parse(read('n8n/24-admin-command-router.json'));

test('campaign CSV is a read-only GET endpoint behind the admin handler', () => {
  assert.match(worker, /campaignStatusMatch[\s\S]*?if \(request\.method !== 'GET'\)/);
  assert.match(worker, /handleAdminCampaignStatusCsv\(request, env, decodeURIComponent/);
  assert.match(admin, /export async function handleAdminCampaignStatusCsv/);
  assert.match(admin, /Content-Disposition/);
  assert.ok(admin.includes("if (/^[=+\\-@\\t\\r]/.test(text))"));
  assert.match(client, /\/status\.csv/);
});

test('campaign CSV query avoids the reserved BigQuery keyword ROWS as an alias', () => {
  const query = admin.match(/function campaignStatusQuery[\s\S]*?\n}\n/)[0];
  assert.doesNotMatch(query, /\bAS\s+rows\b/i);
  assert.match(query, /AS roster_rows/);
  assert.match(admin, /result\.roster_rows \?\? \[\]/);
});

test('campaign archive controls remain reversible and use the audited command route', () => {
  assert.match(client, /Current and unarchived/);
  assert.match(client, /data-campaign-action/);
  assert.match(client, /restore_campaign/);
  assert.match(client, /This only changes the dashboard view/);
  assert.match(admin, /'archive_campaign', 'restore_campaign'/);
  assert.ok(router.nodes.some((node) => node.name === 'Archive or Restore Campaign'));
  assert.match(router.nodes.find((node) => node.name === 'Validate and Normalize Command').parameters.jsCode, /archive_campaign/);
});

test('campaign builder keeps filtered select-all and deselect-all controls', () => {
  assert.match(client, /Select all shown/);
  assert.match(client, /Deselect all/);
  assert.match(client, /selectedCount \+ newSelectionCount > 200/);
  assert.match(client, /visibleOptions\.forEach/);
});

test('Worker preserves same-origin interview API proxy routes', () => {
  for (const route of ['/api/validate', '/api/start', '/api/complete']) {
    assert.ok(worker.includes(`'${route}': '/webhook/aac/interview/${route.split('/').at(-1)}'`), `${route} should remain proxied`);
  }
});

test('campaign builder offers a shared monthly theme or three unique topics', () => {
  assert.match(client, /name="topic_layout"/);
  assert.match(client, /value="shared_theme"/);
  assert.match(client, /value="unique"/);
  assert.match(client, /Use the same featured image as Topic 1/);
  assert.match(client, /data\.has\(`topic_\$\{number\}_use_topic_1_image`\) \? 1 : number/);
});

test('campaign builder sends an optional, validated WordPress slug for each topic', () => {
  assert.match(client, /name="topic_\$\{number\}_wordpress_slug"/);
  assert.match(client, /wordpress_slug: wordpressSlug/);
  assert.match(client, /Each topic needs a different WordPress URL slug/);
  assert.match(admin, /'\$\.wordpress_slug'\) AS wordpress_slug/);

  const validate = router.nodes.find((node) => node.name === 'Validate and Normalize Command').parameters.jsCode;
  assert.match(validate, /wordpress_slug: wordpressSlug \|\| null/);
  const create = router.nodes.find((node) => node.name === 'Create Audited Campaign').parameters.sqlQuery;
  assert.match(create, /ADD COLUMN IF NOT EXISTS wordpress_slug STRING/);
  assert.match(create, /wordpress_publish_date, wordpress_slug,/);
});

test('router accepts a valid topic slug and rejects malformed or repeated slugs', async () => {
  const source = router.nodes.find((node) => node.name === 'Validate and Normalize Command').parameters.jsCode;
  const run = (topics) => new Function('$json', source)({ body: {
    action: 'launch_campaign', actor_email: 'admin@apexdp.com', idempotency_key: 'abcdefghijklmnop1234',
    audience: 'Linked doctors', send_mode: 'now', campaign_name: 'January 2027 Routine', campaign_month: '2027-01',
    doctor_ids: ['doctor_1'], topics,
  } });
  const image = {
    featured_image_source_url: 'https://apexparent.hostmanpowered.com/wp-content/uploads/a.jpg',
    featured_image_alt_text: 'Toothbrush on a counter',
    featured_image_rights_reference: 'License reference',
  };
  const topics = (slugs) => ['One', 'Two', 'Three'].map((title, index) => ({ title, ...image, wordpress_slug: slugs[index] }));

  const stored = JSON.parse(run(topics(['first-topic', '', 'Third-Topic']))[0].json.topics_json);
  assert.deepEqual(stored.map((topic) => topic.wordpress_slug), ['first-topic', null, 'third-topic']);
  assert.throws(() => run(topics(['bad slug', '', ''])), /WordPress URL slug/);
  assert.throws(() => run(topics(['same', 'same', ''])), /different WordPress URL slug/);
});

test('campaign launch saves the rights reference and no longer asks for an image source type', () => {
  const normalizer = router.nodes.find((node) => node.name === 'Validate and Normalize Command').parameters.jsCode;
  const run = (firstTopic = topic(1)) => new Function('$json', normalizer)({ body: {
    action: 'launch_campaign', actor_email: 'admin@apexdp.com', idempotency_key: 'test_idempotency_key_0001',
    audience: 'Presentation preview', campaign_name: 'Image rights test', campaign_month: '2026-12',
    send_mode: 'now', doctor_ids: ['doctor_1'], topics: [firstTopic, topic(2), topic(3)],
  } });
  const topic = (number, overrides = {}) => ({
    title: `Topic ${number}`,
    featured_image_source_url: `https://apexparent.hostmanpowered.com/wp-content/uploads/topic-${number}.jpg`,
    featured_image_alt_text: `Featured image for topic ${number}`,
    featured_image_rights_reference: `  License ${number}  `,
    wordpress_slug: `topic-${number}`,
    ...overrides,
  });

  const topics = JSON.parse(run()[0].json.topics_json);
  assert.equal(topics[0].featured_image_rights_reference, 'License 1');
  assert.equal('featured_image_source_type' in topics[0], false);
  assert.throws(() => run(topic(1, { featured_image_rights_reference: '   ' })), /image rights or source reference/);

  assert.doesNotMatch(client, /featured_image_source_type/);
  assert.match(client, /featured_image_rights_reference: value\('featured_image_rights_reference'\)/);
  const sql = router.nodes.find((node) => node.name === 'Create Audited Campaign').parameters.sqlQuery;
  const insert = sql.match(/INSERT INTO `[^`]+\.campaign_topics`([\s\S]*?)FROM UNNEST/)[1];
  assert.match(insert, /featured_image_alt_text,\s*featured_image_rights_reference, wordpress_publish_date, wordpress_slug/);
  assert.match(insert, /JSON_VALUE\(topic, '\$\.featured_image_alt_text'\),\s*JSON_VALUE\(topic, '\$\.featured_image_rights_reference'\)/);
  assert.doesNotMatch(sql.replace(/ADD COLUMN IF NOT EXISTS featured_image_source_type STRING/, ''), /featured_image_source_type/);
});
