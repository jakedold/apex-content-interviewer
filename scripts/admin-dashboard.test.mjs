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

test('launch_campaign carries featured image source type and rights reference into campaign_topics', () => {
  const normalizer = router.nodes.find((node) => node.name === 'Validate and Normalize Command').parameters.jsCode;
  const run = (body) => new Function('$json', normalizer)({ body });
  const topic = (number, overrides = {}) => ({
    title: `Topic ${number}`,
    featured_image_source_url: `https://apexparent.hostmanpowered.com/wp-content/uploads/topic-${number}.jpg`,
    featured_image_alt_text: `Featured image for topic ${number}`,
    featured_image_source_type: '  Licensed stock  ',
    featured_image_rights_reference: `  License ${number}  `,
    ...overrides,
  });
  const body = (firstTopic = topic(1)) => ({
    action: 'launch_campaign',
    actor_email: 'admin@apexdp.com',
    idempotency_key: 'test_idempotency_key_0001',
    audience: 'Presentation preview',
    campaign_name: 'Image rights test',
    campaign_month: '2026-12',
    send_mode: 'now',
    doctor_ids: ['doctor_1'],
    topics: [firstTopic, topic(2), topic(3)],
  });

  const topics = JSON.parse(run(body())[0].json.topics_json);
  assert.equal(topics[0].featured_image_source_type, 'Licensed stock');
  assert.equal(topics[0].featured_image_rights_reference, 'License 1');

  for (const sourceType of ['Apex-owned or commissioned', 'Licensed stock', 'AI-generated with approved terms']) {
    assert.doesNotThrow(() => run(body(topic(1, { featured_image_source_type: sourceType }))));
  }
  assert.throws(() => run(body(topic(1, { featured_image_source_type: '' }))), /Topic 1 needs a supported featured image source type/);
  assert.throws(() => run(body(topic(1, { featured_image_source_type: 'Found online' }))), /Topic 1 needs a supported featured image source type/);
  assert.throws(() => run(body(topic(1, { featured_image_rights_reference: '   ' }))), /Topic 1 needs a featured image rights or source reference/);

  const sql = router.nodes.find((node) => node.name === 'Create Audited Campaign').parameters.sqlQuery;
  const insert = sql.match(/INSERT INTO `[^`]+\.campaign_topics`([\s\S]*?)FROM UNNEST/)[1];
  assert.match(insert, /wordpress_publish_date,\s*featured_image_source_type, featured_image_rights_reference,\s*topic_sort_order/);
  assert.match(insert, /JSON_VALUE\(topic, '\$\.featured_image_source_type'\),\s*JSON_VALUE\(topic, '\$\.featured_image_rights_reference'\),\s*offset \+ 1/);
});
