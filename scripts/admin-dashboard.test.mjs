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
  assert.doesNotMatch(client, /use_topic_1_image|Use the same featured image as Topic 1/);
  assert.match(client, /const detailsTopic = \(number: number\) => \(sharedTheme \? 1 : number\);/);
  assert.match(client, /data\.get\(`topic_\$\{detailsTopic\(number\)\}_\$\{field\}`\)/);
  assert.match(client, /data\.get\(`topic_\$\{detailsTopic\(number\)\}_wordpress_slug`\)/);
  assert.match(client, /if \(!sharedTheme && new Set\(chosenSlugs\)\.size !== chosenSlugs\.length\)/);
  assert.match(client, /CAMPAIGN_TOPIC_SHARED_FIELDS = \[\s*'wordpress_slug',\s*'featured_image_source_url',\s*'featured_image_alt_text',\s*\]/);
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
  };
  const topics = (slugs) => ['One', 'Two', 'Three'].map((title, index) => ({ title, ...image, wordpress_slug: slugs[index] }));

  const stored = JSON.parse(run(topics(['first-topic', '', 'Third-Topic']))[0].json.topics_json);
  assert.deepEqual(stored.map((topic) => topic.wordpress_slug), ['first-topic', null, 'third-topic']);
  assert.throws(() => run(topics(['bad slug', '', ''])), /WordPress URL slug/);
  assert.throws(() => run(topics(['same', 'same', ''])), /different WordPress URL slug/);
  assert.throws(() => run(topics(['same', 'same', 'other'])), /different WordPress URL slug/);
  const shared = JSON.parse(run(topics(['monthly-theme', 'monthly-theme', 'monthly-theme']))[0].json.topics_json);
  assert.deepEqual(shared.map((topic) => topic.wordpress_slug), ['monthly-theme', 'monthly-theme', 'monthly-theme']);
});

test('campaign builder and AAC-24 no longer use image source type or rights reference', () => {
  const normalizer = router.nodes.find((node) => node.name === 'Validate and Normalize Command').parameters.jsCode;
  const topic = (number) => ({
    title: `Topic ${number}`,
    featured_image_source_url: `https://apexparent.hostmanpowered.com/wp-content/uploads/topic-${number}.jpg`,
    featured_image_alt_text: `Featured image for topic ${number}`,
    wordpress_slug: `topic-${number}`,
  });
  const result = new Function('$json', normalizer)({ body: {
    action: 'launch_campaign', actor_email: 'admin@apexdp.com', idempotency_key: 'test_idempotency_key_0001',
    audience: 'Presentation preview', campaign_name: 'Image details test', campaign_month: '2026-12',
    send_mode: 'now', doctor_ids: ['doctor_1'], topics: [topic(1), topic(2), topic(3)],
  } });
  const topics = JSON.parse(result[0].json.topics_json);
  assert.deepEqual(Object.keys(topics[0]).sort(), ['featured_image_alt_text', 'featured_image_source_url', 'title', 'wordpress_publish_date', 'wordpress_slug']);

  assert.doesNotMatch(client, /featured_image_source_type|featured_image_rights_reference/);
  assert.doesNotMatch(admin, /featured_image_source_type|featured_image_rights_reference/);
  const sql = router.nodes.find((node) => node.name === 'Create Audited Campaign').parameters.sqlQuery;
  const insert = sql.match(/INSERT INTO `[^`]+\.campaign_topics`([\s\S]*?)FROM UNNEST/)[1];
  assert.match(insert, /featured_image_alt_text,\s*wordpress_publish_date, wordpress_slug/);
  const withoutColumnSetup = sql.replace(/ADD COLUMN IF NOT EXISTS featured_image_(source_type|rights_reference) STRING/g, '');
  assert.doesNotMatch(withoutColumnSetup, /featured_image_source_type|featured_image_rights_reference/);
});

test('the stage tracker follows the Apex process from campaign to live on the website', () => {
  const labels = ['Campaign created', 'Invitation emailed', 'Interview completed', 'Doctor review', 'Marketing review', 'On WordPress', 'Ready to Push', 'Published'];
  const tracker = client.match(/function stageVisual[\s\S]*?\n}\n/)[0];
  let last = -1;
  for (const label of labels) {
    const at = tracker.indexOf("'" + label + "'");
    assert.ok(at > last, label + ' should appear in order');
    last = at;
  }
  assert.doesNotMatch(tracker, /'Topic selected'/);
  assert.match(client, /event\.event_type === 'article\.marked_live'/);
});

test('"Push to the next step" offers the manual step for each stage through the audited command route', () => {
  assert.match(client, /action: 'approve_for_doctor'/);
  assert.match(client, /action: 'approve_for_marketing'/);
  assert.match(client, /action: 'mark_live_on_website'/);
  assert.match(client, /Approve and send to WordPress/);
  assert.match(client, /button: 'Mark as published'/);
  assert.match(client, /: \{ action: action\.action, article_id: item\.article_id, campaign_id: item\.campaign_id/);
  for (const action of ['approve_for_doctor', 'approve_for_marketing', 'mark_live_on_website']) {
    assert.match(admin, new RegExp("ADMIN_ACTIONS = \\[[^\\]]*'" + action + "'"));
  }
  assert.match(admin, /enabledActions: canAct \? \[\.\.\.ADMIN_ACTIONS\]/);
  assert.match(admin, /\(ADMIN_ACTIONS as readonly string\[\]\)\.includes\(String\(command\.action\)\)/);
});

test('articles on WordPress stay in the work queue until they are marked live', () => {
  assert.match(admin, /OR \(a\.published_at >= TIMESTAMP_SUB\(CURRENT_TIMESTAMP\(\), INTERVAL 90 DAY\)[\s\S]*?event_type = 'article\.marked_live'/);
});

test('router records "live on website" only for an article on WordPress, once, without changing its status', () => {
  const source = router.nodes.find((node) => node.name === 'Validate and Normalize Command').parameters.jsCode;
  const run = (body) => new Function('$json', source)({ body: { actor_email: 'admin@apexdp.com', idempotency_key: 'abcdefghijklmnop1234', ...body } });
  const command = { action: 'mark_live_on_website', article_id: 'article_1', campaign_id: 'campaign_1', doctor_id: 'doctor_1' };
  const result = run({ ...command, expected_status: 'PUBLISHED', reason: 'Pushed in Headless Hostman' })[0].json;
  assert.equal(result.note, 'Pushed in Headless Hostman');
  assert.equal(run({ ...command, expected_status: 'PUBLISHED' })[0].json.note, '');
  assert.throws(() => run({ ...command, expected_status: 'MARKETING_REVIEW' }), /on WordPress/);

  const switchRules = router.nodes.find((node) => node.name === 'Route Narrow Command').parameters.rules.values;
  const index = switchRules.findIndex((rule) => rule.conditions.conditions[0].rightValue === 'mark_live_on_website');
  assert.ok(index >= 0);
  assert.equal(router.connections['Route Narrow Command'].main[index][0].node, 'Record Live on Website');
  const query = router.nodes.find((node) => node.name === 'Record Live on Website').parameters.sqlQuery;
  assert.match(query, /status = 'PUBLISHED'/);
  assert.match(query, /already marked live/);
  assert.match(query, /'article\.marked_live'/);
  assert.doesNotMatch(query, /UPDATE `[^`]*\.articles`/);
  assert.equal(router.connections['Record Live on Website'].main[0][0].node, 'Return Live on Website Result');
});

test('several articles can be moved to their next step at once, one audited command each', () => {
  assert.match(client, /\['ready', 'Ready to push'/);
  assert.match(client, /function queueNextStep\(item: WorkItem\): QueueStep \| null/);
  assert.match(client, /if \(item\.archived\) step = null;/);
  assert.match(client, /item\.status === 'DOCTOR_REVIEW_PENDING'\) step = 'approve_for_doctor'/);
  assert.match(client, /\(DOCTOR_APPROVED\|DOCTOR_AUTO_APPROVED\|MARKETING_REVIEW\)\$\/\.test\(item\.status\)\) step = 'approve_for_marketing'/);
  assert.match(client, /isReadyToPush\(item\)\) step = 'mark_live_on_website'/);
  assert.match(client, /data-item-select=/);
  assert.match(client, /id="admin-item-select-all"/);
  assert.match(client, /data-bulk-action="next" data-label="Move to next step"/);
  const bulk = client.match(/async function submitBulkStep[\s\S]*?\n}\n/)[0];
  assert.match(bulk, /for \(const item of targets\) \{[\s\S]*?await postAdminCommand\(\{ \.\.\.command,/);
  assert.match(bulk, /action: step, article_id: item\.article_id, expected_status: item\.status, expected_version: item\.current_version/);
  assert.match(bulk, /Not done:/);
  const queue = admin.match(/queue_rows AS \([\s\S]*?\n\),/)[0];
  for (const field of ['a.current_version', 'c.require_marketing_approval', 'AS marketing_auto_approved', 'AS doctor_auto_approved', 'AS archived', 'AS do_not_use']) assert.ok(queue.includes(field), field);
});

test('auto-approved articles are flagged for extra attention in the queue and the article view', () => {
  assert.match(client, /Auto-approved \(\$\{escapeHtml\(who\.join\(' and '\)\)\}\) · check carefully/);
  assert.match(client, /Auto-approved: check carefully/);
  assert.match(client, /approval\.approval_type === 'MARKETING_REVIEW' && approval\.status === 'AUTO_APPROVED'/);
  assert.match(client, /event\.event_type === 'marketing\.auto_approved'/);
  assert.match(client, /Automatically approved after 24 hours without a response/);
});

test('marketing can request changes from the dashboard; the AI revision starts without blocking the dashboard', () => {
  assert.match(admin, /ADMIN_ACTIONS = \[[^\]]*'request_marketing_changes'/);
  assert.match(client, /action: 'request_marketing_changes'/);
  assert.match(client, /Send change request/);
  const source = router.nodes.find((node) => node.name === 'Validate and Normalize Command').parameters.jsCode;
  const run = (body) => new Function('$json', source)({ body: { actor_email: 'admin@apexdp.com', idempotency_key: 'abcdefghijklmnop1234',
    action: 'request_marketing_changes', article_id: 'article_1', campaign_id: 'campaign_1', doctor_id: 'doctor_1', expected_version: 2, ...body } });
  assert.equal(run({ expected_status: 'MARKETING_REVIEW', reason: 'Remove the link to the product page.' })[0].json.reason, 'Remove the link to the product page.');
  assert.throws(() => run({ expected_status: 'MARKETING_REVIEW', reason: 'too short' }), /12–4000/);
  assert.throws(() => run({ expected_status: 'PUBLISHED', reason: 'Remove the link to the product page.' }), /waiting for marketing/);
  const rules = router.nodes.find((node) => node.name === 'Route Narrow Command').parameters.rules.values;
  const index = rules.findIndex((rule) => rule.conditions.conditions[0].rightValue === 'request_marketing_changes');
  assert.equal(router.connections['Route Narrow Command'].main[index][0].node, 'Record Marketing Change Request');
  const query = router.nodes.find((node) => node.name === 'Record Marketing Change Request').parameters.sqlQuery;
  assert.match(query, /status = 'MARKETING_CHANGES_REQUESTED'/);
  assert.match(query, /'CHANGES_REQUESTED', CURRENT_TIMESTAMP\(\), CURRENT_TIMESTAMP\(\), @reason/);
  assert.match(query, /'revision\.requested'/);
  const start = router.nodes.find((node) => node.name === 'Start Marketing Revision');
  assert.equal(start.parameters.workflowId.cachedResultName, 'AAC - 20 - Revise Article from Marketing Feedback');
  assert.equal(start.parameters.options.waitForSubWorkflow, false);
  assert.equal(router.connections['Record Marketing Change Request'].main[0][0].node, 'Return Change Request Result');
  assert.equal(router.connections['Return Change Request Result'].main[0][0].node, 'Start Marketing Revision');
});

test('marketing reviews nobody answers are auto-approved after 24 hours, within safety limits, then sent to WordPress', () => {
  const workflow = JSON.parse(read('n8n/21-auto-approve-expired-marketing-reviews.json'));
  assert.equal(workflow.active, false);
  const query = workflow.nodes.find((node) => node.name === 'Auto-Approve Expired Marketing Reviews').parameters.sqlQuery;
  assert.match(query, /ap\.requested_at <= TIMESTAMP_SUB\(CURRENT_TIMESTAMP\(\), INTERVAL 24 HOUR\)/);
  assert.match(query, /ap\.requested_at >= TIMESTAMP_SUB\(CURRENT_TIMESTAMP\(\), INTERVAL 7 DAY\)/);
  assert.match(query, /LIMIT 25;/);
  assert.match(query, /status = 'AUTO_APPROVED'/);
  assert.match(query, /status = 'MARKETING_APPROVED'/);
  assert.match(query, /'marketing\.auto_approved'/);
  const send = workflow.nodes.find((node) => node.name === 'Send Auto-Approved Article to WordPress');
  assert.equal(send.parameters.workflowId.cachedResultName, 'AAC - 15 - Publish Approved Article to WordPress');
  assert.equal(send.parameters.mode, 'each');
  assert.deepEqual(workflow.connections['Auto-Approve Expired Marketing Reviews'].main[0].map((c) => c.node), ['Send Auto-Approved Article to WordPress']);
  assert.ok(workflow.nodes.every((node) => !node.credentials));
  const invitation = JSON.parse(read('n8n/18-send-marketing-review-invitation.json'));
  assert.match(invitation.nodes.find((node) => node.name === 'Prepare Marketing Review Email').parameters.jsCode, /the article is approved automatically and sent to WordPress \(not the live site\)/);
});

test('the work queue has a filter for every stage, defaults to active items, and pages long lists', () => {
  const filters = client.match(/const QUEUE_FILTERS[\s\S]*?\n\];/)[0];
  const keys = [...filters.matchAll(/\['([a-z_]+)', '([^']+)'/g)].map((match) => match[2]);
  assert.deepEqual(keys, ['Active', 'Invited', 'Interview started', 'Drafting', 'Doctor review', 'Marketing review', 'Sending to WordPress', 'Ready to push', 'Errors', 'Stalled', 'Archived', 'All']);
  assert.match(client, /let queueFilter = 'active';/);
  assert.match(filters, /\['active', 'Active', \(item\) => !item\.archived\]/);
  assert.match(client, /const QUEUE_PAGE_SIZE = 50;/);
  assert.match(client, /id="admin-queue-campaign"/);
  assert.match(admin, /LIMIT 1500\) AS work_queue/);
  // Every stage the queue can report has a filter button.
  const stages = [...client.match(/type QueueStage = ([^;]+);/)[1].matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
  for (const stage of stages) assert.ok(filters.includes(`queueStage(item) === '${stage}'`) || (stage === 'ready_to_push' && filters.includes('isReadyToPush(item)')), stage);
});

test('work items can be archived, marked "Do not use", and restored through the audited command route', () => {
  for (const action of ['archive_work_item', 'restore_work_item']) assert.match(admin, new RegExp("ADMIN_ACTIONS = \\[[^\\]]*'" + action + "'"));
  assert.match(admin, /entity_type = 'work_item' AND event_type IN \('work_item\.archived', 'work_item\.restored'\)/);
  assert.match(admin, /CONCAT\(@campaign_id, ':', @doctor_id\), COALESCE/);
  assert.match(client, /data-bulk-action="do_not_use"/);
  assert.match(client, /data-archive-action="restore"/);
  const source = router.nodes.find((node) => node.name === 'Validate and Normalize Command').parameters.jsCode;
  const run = (body) => new Function('$json', source)({ body: { actor_email: 'admin@apexdp.com', idempotency_key: 'abcdefghijklmnop1234', campaign_id: 'campaign_1', doctor_id: 'doctor_1', ...body } });
  assert.equal(run({ action: 'archive_work_item' })[0].json.do_not_use, 'false');
  assert.equal(run({ action: 'archive_work_item', do_not_use: true, reason: 'Test article' })[0].json.do_not_use, 'true');
  assert.throws(() => run({ action: 'archive_work_item', do_not_use: true }), /short reason/);
  assert.equal(run({ action: 'restore_work_item', do_not_use: true })[0].json.archive, 'false');
  const rules = router.nodes.find((node) => node.name === 'Route Narrow Command').parameters.rules.values;
  for (const action of ['archive_work_item', 'restore_work_item']) {
    const index = rules.findIndex((rule) => rule.conditions.conditions[0].rightValue === action);
    assert.equal(router.connections['Route Narrow Command'].main[index][0].node, 'Archive or Restore Work Item');
  }
  const query = router.nodes.find((node) => node.name === 'Archive or Restore Work Item').parameters.sqlQuery;
  assert.match(query, /SET status = 'DO_NOT_USE'\s+WHERE @do_not_use = 'true'/);
  assert.match(query, /SET status = \(SELECT prior_status FROM target\)\s+WHERE @archive = 'false'/);
  assert.match(query, /'work_item\.archived', 'work_item\.restored'/);
  assert.match(query, /marketing_review_links` SET status = 'EXPIRED'/);
});

test('the internal marketing review email uses the branded "simple letter" design with doctor, practice, and auto-approval time', () => {
  const workflow = JSON.parse(read('n8n/18-send-marketing-review-invitation.json'));
  const node = (name) => workflow.nodes.find((entry) => entry.name === name);
  const query = node('Prepare Fresh Marketing Review Link').parameters.sqlQuery;
  assert.match(query, /p\.practice_name/);
  assert.match(query, /TIMESTAMP_ADD\(COALESCE\(requested_at, CURRENT_TIMESTAMP\(\)\), INTERVAL 24 HOUR\) AS auto_approve_at/);
  const gmail = node('Email Marketing Reviewer').parameters;
  assert.equal(gmail.emailType, 'html');
  assert.equal(gmail.message, '={{ $json.message_html }}');
  const run = (extra = {}) => new Function('$json', node('Prepare Marketing Review Email').parameters.jsCode)({
    article_id: 'a1', campaign_id: 'c1', doctor_email: 'x@apexdp.com', current_version: 2, article_title: 'Gums & <Teeth>',
    doctor_name: 'Dr. Test', credentials: 'DDS', practice_name: 'Test Dental', auto_approve_at: '2026-11-06T21:15:00Z',
    review_url: 'https://apex-content-interviewer.jdold.workers.dev/marketing-review/abc123', ...extra }).json;
  const email = run();
  assert.equal(email.recipient, 'ndorsey@apexdp.com');
  assert.match(email.message_html, /Gums &amp; &lt;Teeth&gt;/);
  assert.match(email.message_html, /Dr\. Test, DDS · Test Dental/);
  assert.match(email.message_html, /href="https:\/\/apex-content-interviewer\.jdold\.workers\.dev\/marketing-review\/abc123"/);
  assert.match(email.message_html, /Friday, November 6 at 3:15 PM CT/);
  assert.match(email.message_html, /\/brand\/email-mark\.png/);
  assert.match(email.message_html, /PRIVATE PRACTICE REIMAGINED/);
  assert.throws(() => run({ review_url: 'javascript:alert(1)' }), /malformed/);
  assert.ok(fs.existsSync(new URL('../public/brand/email-mark.png', import.meta.url)));
  assert.ok(fs.existsSync(new URL('../public/brand/email-logo.png', import.meta.url)));
});

test('a completed interview with no draft can have its draft written from the dashboard, after eligibility checks', () => {
  assert.match(admin, /ADMIN_ACTIONS = \[[^\]]*'generate_article'/);
  assert.match(admin, /COALESCE\(i\.interview_id, ''\) AS interview_id/);
  assert.match(client, /action: 'generate_article',/);
  assert.match(client, /Write the draft now/);
  assert.match(client, /queueStage\(item\) === 'drafting'\) step = 'generate_article'/);
  const source = router.nodes.find((node) => node.name === 'Validate and Normalize Command').parameters.jsCode;
  const run = (body) => new Function('$json', source)({ body: { actor_email: 'admin@apexdp.com', idempotency_key: 'abcdefghijklmnop1234', action: 'generate_article', campaign_id: 'campaign_1', doctor_id: 'doctor_1', ...body } });
  assert.equal(run({ interview_id: 'interview_1' })[0].json.interview_id, 'interview_1');
  assert.throws(() => run({}), /Missing interview_id/);
  const rules = router.nodes.find((node) => node.name === 'Route Narrow Command').parameters.rules.values;
  const index = rules.findIndex((rule) => rule.conditions.conditions[0].rightValue === 'generate_article');
  assert.equal(router.connections['Route Narrow Command'].main[index][0].node, 'Check and Record Draft Request');
  const query = router.nodes.find((node) => node.name === 'Check and Record Draft Request').parameters.sqlQuery;
  for (const message of ['already has an article draft', 'under 100 words', 'preview-only campaign', 'not fully set up for WordPress publishing', 'doctor profile is incomplete', 'Doctor Profiles tab']) assert.ok(query.includes(message), message);
  assert.match(query, /REGEXP_EXTRACT_ALL\(TRIM\(transcript\), r'\\S\+'\)\) >= 100/);
  const start = router.nodes.find((node) => node.name === 'Start Article Draft');
  assert.equal(start.parameters.workflowId.cachedResultName, 'AAC - 06 - Generate Article');
  assert.equal(start.parameters.workflowInputs.value.interview_id, '={{ $json.interview_id }}');
  assert.equal(start.parameters.options.waitForSubWorkflow, false);
});

test('items that sit too long at one step are flagged as stalled and get their own filter', () => {
  const stalled = client.match(/function stalledReason[\s\S]*?\n}\n/)[0];
  for (const reason of ['no draft after 1 hour', 'rewrite not finished after 2 hours', 'in doctor review over 6 days', 'waiting for marketing over 2 days', 'not on WordPress after 2 hours']) assert.ok(stalled.includes(reason), reason);
  assert.match(client, /\['stalled', 'Stalled', \(item\) => Boolean\(stalledReason\(item\)\)\]/);
  assert.match(client, /\$\{stalledFlag\(item\)\}/);
});

test('the census sync reads Doctor Profiles once, however many Test User rows there are', () => {
  const sync = JSON.parse(read('n8n/25-sync-doctor-census.json'));
  assert.deepEqual(sync.connections['Read test users'].main[0].map((c) => c.node), ['Read doctor profiles']);
  assert.equal(sync.nodes.find((node) => node.name === 'Read doctor profiles').executeOnce, true);
});

test('the router answers the dashboard before starting a long-running draft or revision', () => {
  for (const [record, reply, start] of [['Check and Record Draft Request', 'Return Draft Request Result', 'Start Article Draft'], ['Record Marketing Change Request', 'Return Change Request Result', 'Start Marketing Revision']]) {
    assert.deepEqual(router.connections[record].main[0].map((c) => c.node), [reply]);
    assert.deepEqual(router.connections[reply].main[0].map((c) => c.node), [start]);
    assert.equal(router.connections[start], undefined);
  }
  assert.match(router.nodes.find((node) => node.name === 'Return Draft Request Result').parameters.responseBody, /interview_id: \$json\.interview_id/);
});

test('router SQL never escapes apostrophes by doubling them (BigQuery rejects that syntax)', () => {
  for (const file of ['n8n/24-admin-command-router.json', 'n8n/21-auto-approve-expired-marketing-reviews.json', 'n8n/18-send-marketing-review-invitation.json']) {
    for (const node of JSON.parse(read(file)).nodes) {
      const query = node.parameters?.sqlQuery;
      if (query) assert.doesNotMatch(query, /[A-Za-z]''[A-Za-z]/, `${file}: ${node.name}`);
    }
  }
});

test('the census sync also applies Doctor Profiles to doctors outside the census, such as test users', () => {
  const sync = JSON.parse(read('n8n/25-sync-doctor-census.json'));
  const prepare = sync.nodes.find((node) => node.name === 'Prepare Current Census Roster').parameters.jsCode;
  assert.match(prepare, /profiles: \[\.\.\.profilesByKey\.entries\(\)\]/);
  const query = sync.nodes.find((node) => node.name === 'Sync Census to BigQuery').parameters.sqlQuery;
  assert.match(query, /JSON_QUERY_ARRAY\(roster, '\$\.profiles'\)/);
  assert.match(query, /WHERE LOWER\(TRIM\(T\.email\)\) = P\.email\s+AND NOT EXISTS \(SELECT 1 FROM source_doctors S WHERE S\.doctor_id = T\.doctor_id\)/);
  assert.match(query, /PARTITION BY LOWER\(TRIM\(JSON_VALUE\(profile, '\$\.email'\)\)\)/);
  assert.doesNotMatch(query, /[A-Za-z]''[A-Za-z]/);
});
