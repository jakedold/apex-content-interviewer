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
  assert.match(admin, /OR \(a\.published_at >= TIMESTAMP_SUB\(CURRENT_TIMESTAMP\(\), INTERVAL 90 DAY\) AND la\.entity_id IS NULL\)/);
  assert.match(admin, /LEFT JOIN live_articles la ON la\.entity_id = a\.article_id/);
  assert.match(admin, /live_articles AS \([\s\S]*?event_type = 'article\.marked_live'[\s\S]*?\),\nqueue_rows AS/);
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
  const keys = [...filters.matchAll(/^\s*\['([a-z_]+)', '([^']+)'/gm)].map((match) => match[2]);
  assert.deepEqual(keys, ['Active', 'Awaiting interview', 'Doctor review', 'Marketing review', 'On hold', 'Ready to push', 'Auto-approved', 'Published', 'Needs attention', 'Archived', 'All']);
  assert.match(client, /let queueFilter = 'active';/);
  // Active leaves out doctors who have not responded yet and finished (published) items.
  assert.match(filters, /\['active', 'Active', \(item\) => !item\.archived && !\['invited', 'published', 'on_hold'\]\.includes\(queueStage\(item\)\)\]/);
  assert.match(client, /const QUEUE_PAGE_SIZE = 50;/);
  assert.match(client, /id="admin-queue-campaign"/);
  assert.match(admin, /LIMIT 1500\) AS work_queue/);
  // Every stage the queue can report has a filter button.
  const stages = [...client.match(/type QueueStage = ([^;]+);/)[1].matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
  for (const stage of stages) assert.ok(filters.includes(`'${stage}'`), stage);
});

test('work items can be archived, marked "Do not use", and restored through the audited command route', () => {
  for (const action of ['archive_work_item', 'restore_work_item']) assert.match(admin, new RegExp("ADMIN_ACTIONS = \\[[^\\]]*'" + action + "'"));
  assert.match(admin, /entity_type = 'work_item' AND event_type IN \('work_item\.archived', 'work_item\.restored'\)/);
  assert.match(admin, /CONCAT\(@campaign_id, ':', @doctor_id\), CONCAT\(@campaign_id, ':', @doctor_id, ':', @interview_id\), COALESCE/);
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
  assert.match(client, /\['drafting', 'on_hold'\]\.includes\(queueStage\(item\)\)\) step = 'generate_article'/);
  const source = router.nodes.find((node) => node.name === 'Validate and Normalize Command').parameters.jsCode;
  const run = (body) => new Function('$json', source)({ body: { actor_email: 'admin@apexdp.com', idempotency_key: 'abcdefghijklmnop1234', action: 'generate_article', campaign_id: 'campaign_1', doctor_id: 'doctor_1', ...body } });
  assert.equal(run({ interview_id: 'interview_1' })[0].json.interview_id, 'interview_1');
  assert.throws(() => run({}), /Missing interview_id/);
  const rules = router.nodes.find((node) => node.name === 'Route Narrow Command').parameters.rules.values;
  const index = rules.findIndex((rule) => rule.conditions.conditions[0].rightValue === 'generate_article');
  assert.equal(router.connections['Route Narrow Command'].main[index][0].node, 'Check and Record Draft Request');
  const query = router.nodes.find((node) => node.name === 'Check and Record Draft Request').parameters.sqlQuery;
  for (const message of ['already has an article draft', 'under 300 words', 'preview-only campaign', 'not fully set up for WordPress publishing', 'doctor profile is incomplete', 'Doctor Profiles tab']) assert.ok(query.includes(message), message);
  assert.match(query, /REGEXP_EXTRACT_ALL\(TRIM\(transcript\), r'\\S\+'\)\) >= 300/);
  const start = router.nodes.find((node) => node.name === 'Start Article Draft');
  assert.equal(start.parameters.workflowId.cachedResultName, 'AAC - 06 - Generate Article');
  assert.equal(start.parameters.workflowInputs.value.interview_id, '={{ $json.interview_id }}');
  assert.equal(start.parameters.options.waitForSubWorkflow, false);
});

test('items that sit too long at one step are flagged as stalled and get their own filter', () => {
  const stalled = client.match(/function stalledReason[\s\S]*?\n}\n/)[0];
  for (const reason of ['no draft after 1 hour', 'rewrite not finished after 2 hours', 'in doctor review over 6 days', 'waiting for marketing over 2 days', 'not on WordPress after 2 hours']) assert.ok(stalled.includes(reason), reason);
  // Errors and stalled items share one "Needs attention" filter.
  assert.match(client, /\['attention', 'Needs attention', \(item\) => !item\.archived && \(\['errors', 'too_short'\]\.includes\(queueStage\(item\)\) \|\| Boolean\(stalledReason\(item\)\)\)\]/);
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

test('every database step in the admin router retries a brief BigQuery conflict', () => {
  for (const node of router.nodes.filter((entry) => entry.type.endsWith('googleBigQuery'))) {
    assert.equal(node.retryOnFail, true, node.name);
    assert.ok(node.maxTries >= 3, node.name);
  }
});

test('"Re-send to WordPress" updates the existing post through the audited route and returns the article to Ready to Push', () => {
  assert.match(admin, /ADMIN_ACTIONS = \[[^\]]*'republish_to_wordpress'/);
  assert.match(client, /action: 'republish_to_wordpress'/);
  assert.match(client, /id="admin-resend-form"/);
  // A "marked live" record only counts if it came after the latest re-send, in the dashboard, the queue, and the router.
  assert.match(client, /event\.event_type === 'article\.marked_live' && eventTime\(event\) > latestResend/);
  assert.match(admin, /'article\.resent_to_wordpress'[\s\S]*?event_type = 'article\.marked_live' AND e\.entity_id IS NOT NULL\s*AND e\.event_timestamp > COALESCE\(r\.resent_at/);
  // BigQuery rejects correlated subqueries that read another table inside a filter (this broke the dashboard once).
  assert.doesNotMatch(admin, /COALESCE\(\(SELECT MAX\(/);
  assert.match(router.nodes.find((node) => node.name === 'Record Live on Website').parameters.sqlQuery, /'article\.resent_to_wordpress'/);

  const source = router.nodes.find((node) => node.name === 'Validate and Normalize Command').parameters.jsCode;
  const run = (body) => new Function('$json', source)({ body: { actor_email: 'admin@apexdp.com', idempotency_key: 'abcdefghijklmnop1234', ...body } });
  const command = { action: 'republish_to_wordpress', article_id: 'article_1', campaign_id: 'campaign_1', doctor_id: 'doctor_1' };
  assert.equal(run({ ...command, expected_status: 'PUBLISHED', reason: 'New photo' })[0].json.note, 'New photo');
  assert.throws(() => run({ ...command, expected_status: 'MARKETING_REVIEW' }), /already on WordPress/);

  const rules = router.nodes.find((node) => node.name === 'Route Narrow Command').parameters.rules.values;
  const index = rules.findIndex((rule) => rule.conditions.conditions[0].rightValue === 'republish_to_wordpress');
  assert.ok(index >= 0);
  assert.equal(router.connections['Route Narrow Command'].main[index][0].node, 'Record WordPress Re-send');
  const query = router.nodes.find((node) => node.name === 'Record WordPress Re-send').parameters.sqlQuery;
  assert.match(query, /status = 'PUBLISHED'/);
  assert.match(query, /NULLIF\(TRIM\(external_post_id\), ''\) IS NOT NULL/);
  assert.doesNotMatch(query, /''[A-Za-z]/, 'BigQuery messages must not use doubled-quote apostrophes');
  // Reply first, then start the publisher without waiting, with republishing allowed.
  assert.equal(router.connections['Record WordPress Re-send'].main[0][0].node, 'Return WordPress Re-send Result');
  assert.equal(router.connections['Return WordPress Re-send Result'].main[0][0].node, 'Re-send Article to WordPress');
  const start = router.nodes.find((node) => node.name === 'Re-send Article to WordPress');
  assert.equal(start.parameters.workflowId.value, 'kGd2YSJ2MVJwRld0');
  assert.equal(start.parameters.workflowInputs.value.allow_republish, true);
  assert.equal(start.parameters.options.waitForSubWorkflow, false);
  assert.equal(router.nodes.find((node) => node.name === 'Record WordPress Re-send').retryOnFail, true);
});

test('every interview is its own work item, so a doctor with several interviews in one campaign shows several rows', () => {
  // Queue, CSV, and detail use one row per interview, with that interview's own article.
  assert.match(admin, /work_interviews AS \(/);
  assert.match(admin, /CONCAT\(cd\.campaign_id, ':', cd\.doctor_id, IF\(i\.interview_id IS NULL, '', CONCAT\(':', i\.interview_id\)\)\) AS work_item_id/);
  assert.equal((admin.match(/LEFT JOIN interview_articles a ON a\.join_key = COALESCE\(i\.interview_id/g) || []).length, 2, 'queue and CSV both join the interview\'s own article');
  assert.match(admin, /AND \(@interview_id = '' OR a\.interview_id = @interview_id\)/);
  assert.match(admin, /stringParameter\('interview_id', interviewId\)/);
  assert.match(worker, /url\.searchParams\.get\('interview_id'\)/);
  assert.match(client, /\?interview_id=\$\{encodeURIComponent\(item\.interview_id\)\}/);
  // An abandoned restart of the same topic does not add a duplicate row.
  assert.match(admin, /WHERE \(completed_at IS NOT NULL OR has_article OR topic_rank = 1\)/);
  // Campaign counts include every article, not just each doctor's latest.
  assert.match(admin, /campaign_article_counts AS \(/);
  // Archive decisions apply to one interview; older whole-row decisions still count.
  assert.match(admin, /queue_archive AS \([\s\S]*?wa\.entity_id = CONCAT\(u\.campaign_id, ':', u\.doctor_id\)[\s\S]*?wa\.entity_id = u\.work_item_id/);
  assert.match(client, /interview_id: item\.interview_id \|\| ''/);
  assert.match(client, /interview_id: detail\.item\.interview_id \|\| ''/);
  assert.doesNotMatch(admin, /COALESCE\(\(SELECT MAX\(/);

  const source = router.nodes.find((node) => node.name === 'Validate and Normalize Command').parameters.jsCode;
  const run = (body) => new Function('$json', source)({ body: { actor_email: 'admin@apexdp.com', idempotency_key: 'abcdefghijklmnop1234', campaign_id: 'campaign_1', doctor_id: 'doctor_1', ...body } });
  assert.equal(run({ action: 'archive_work_item', interview_id: 'interview_9' })[0].json.work_item_entity, 'campaign_1:doctor_1:interview_9');
  assert.equal(run({ action: 'archive_work_item' })[0].json.work_item_entity, 'campaign_1:doctor_1');
  assert.throws(() => run({ action: 'archive_work_item', interview_id: 'bad id!' }), /Invalid interview/);
  const node = router.nodes.find((entry) => entry.name === 'Archive or Restore Work Item');
  assert.match(node.parameters.sqlQuery, /AND \(@interview_id = '' OR interview_id = @interview_id\)/);
  assert.doesNotMatch(node.parameters.sqlQuery, /CONCAT\(@campaign_id, ':', @doctor_id\)/);
  const names = node.parameters.options.queryParameters.namedParameters.map((param) => param.name);
  assert.ok(names.includes('interview_id') && names.includes('work_item_entity'));
});

test('published articles stay visible for 30 days after they are marked live, and auto-approved items have their own filter', () => {
  assert.match(admin, /SELECT e\.entity_id, MAX\(e\.event_timestamp\) AS live_at/);
  assert.match(admin, /la\.entity_id IS NOT NULL AS live_on_website/);
  assert.match(admin, /OR la\.live_at >= TIMESTAMP_SUB\(CURRENT_TIMESTAMP\(\), INTERVAL 30 DAY\)/);
  assert.match(client, /if \(status === 'PUBLISHED'\) return item\.live_on_website \? 'published' : 'ready_to_push';/);
  assert.match(client, /&& !item\.live_on_website;\n\}/, 'a live article is no longer "ready to push"');
  assert.match(client, /\['auto_approved', 'Auto-approved', \(item\) => !item\.archived && !item\.live_on_website && Boolean\(item\.doctor_auto_approved \|\| item\.marketing_auto_approved\)\]/);
});

test('interview links can be emailed again by topic without cancelling earlier links, and a re-recorded topic replaces its unapproved draft', () => {
  assert.match(admin, /ADMIN_ACTIONS = \[[^\]]*'resend_interview_links'/);
  assert.match(client, /action: 'resend_interview_links', campaign_id: item\.campaign_id/);
  assert.match(client, /id="admin-resend-links-form"/);
  assert.match(admin, /AS topics,/);
  assert.doesNotMatch(admin, /COALESCE\(\(SELECT MAX\(/);
  // The queue hides an earlier interview once the same topic is recorded again, unless its draft was approved.
  assert.equal((admin.match(/AND \(article_status IS NULL OR article_status = 'DO_NOT_USE'\)\)/g) || []).length, 2);

  const source = router.nodes.find((node) => node.name === 'Validate and Normalize Command').parameters.jsCode;
  const run = (body) => new Function('$json', source)({ body: { actor_email: 'admin@apexdp.com', idempotency_key: 'abcdefghijklmnop1234', campaign_id: 'campaign_1', doctor_id: 'doctor_1', ...body } });
  assert.equal(run({ action: 'resend_interview_links' })[0].json.topic_id, '');
  assert.equal(run({ action: 'resend_interview_links', topic_id: 'topic_2' })[0].json.topic_id, 'topic_2');
  assert.throws(() => run({ action: 'resend_interview_links', topic_id: 'bad topic!' }), /Invalid topic/);

  const rules = router.nodes.find((node) => node.name === 'Route Narrow Command').parameters.rules.values;
  const index = rules.findIndex((rule) => rule.conditions.conditions[0].rightValue === 'resend_interview_links');
  assert.equal(router.connections['Route Narrow Command'].main[index][0].node, 'Create Interview Links Again');
  assert.equal(router.connections['Create Interview Links Again'].main[0][0].node, 'Return Interview Links Result');
  assert.equal(router.connections['Return Interview Links Result'].main[0][0].node, 'Compose Interview Links Email');
  assert.equal(router.connections['Compose Interview Links Email'].main[0][0].node, 'Email Interview Links');
  const sql = router.nodes.find((node) => node.name === 'Create Interview Links Again').parameters.sqlQuery;
  assert.doesNotMatch(sql, /SUPERSEDED/, 'earlier links keep working');
  assert.doesNotMatch(sql, /UPDATE `[^`]*\.articles`/, 'nothing already written changes');
  assert.match(sql, /TO_HEX\(SHA256\(raw_token\)\)/, 'only a hash of the token is stored');
  assert.match(sql, /INTERVAL 3650 DAY/, 'no deadline: the link does not expire');
  assert.match(sql, /interview deadline for this campaign has passed/);
  assert.match(sql, /already approved the article for the chosen topic/);
  assert.doesNotMatch(sql, /''[A-Za-z]/);
  const reply = router.nodes.find((node) => node.name === 'Return Interview Links Result').parameters.responseBody;
  assert.doesNotMatch(reply, /interview_url|token/, 'links go only to the doctor');
  assert.equal(router.nodes.find((node) => node.name === 'Email Interview Links').parameters.workflowId.value, 'cZtS9x6kbI46Q2Bi');

  const compose = router.nodes.find((node) => node.name === 'Compose Interview Links Email').parameters.jsCode;
  const rows = [2, 1].map((n) => ({ json: { doctor_name: 'Dr. Test', doctor_id: 'doctor_1', campaign_id: 'campaign_1', campaign_name: 'January', topic_title: 'Topic ' + n, topic_sort_order: n, interview_url: 'https://example.test/interview/' + n, interview_deadline: '2026-12-15', preview_only: false } }));
  const all = new Function('$input', compose)({ all: () => rows })[0].json;
  assert.match(all.message_text, /1\. Topic 1\nhttps:\/\/example\.test\/interview\/1\n\n2\. Topic 2/);
  assert.match(all.message_text, /Any earlier links you received still work/);
  assert.match(all.message_text, /by December 15, 2026/);
  assert.equal(all.communication_type, 'INTERVIEW_LINKS_RESENT');
  const one = new Function('$input', compose)({ all: () => [{ json: { ...rows[0].json, interview_deadline: null } }] })[0].json;
  assert.equal(one.subject, 'Your interview link: Topic 2');
  assert.doesNotMatch(one.message_text, /expires/);

  const persist = JSON.parse(read('n8n/06-generate-article.json')).nodes.find((node) => node.name === 'Persist Initial Article Draft').parameters;
  const q = persist.sqlQuery ?? persist.query;
  assert.match(q, /CREATE TEMP TABLE replaced_articles AS/);
  assert.match(q, /old_i\.topic_id = new_i\.topic_id/);
  assert.match(q, /a\.status NOT IN \('DOCTOR_APPROVED'[^)]*'PUBLISHED', 'DO_NOT_USE'\)/);
  assert.match(q, /'article\.replaced_by_newer_interview'/);
  assert.ok(q.indexOf('replaced_articles') < q.lastIndexOf('SELECT\n  @article_id AS article_id'));
});

test('campaign invitations without an interview deadline do not expire', () => {
  const dispatch = JSON.parse(read('n8n/02-dispatch-campaign-invitations.json'));
  const node = (name) => dispatch.nodes.find((entry) => entry.name === name);
  const sql = node('Create three topic links').parameters.sqlQuery ?? node('Create three topic links').parameters.query;
  assert.match(sql, /IS NULL,\s*-- No interview deadline[^\n]*\n\s*TIMESTAMP_ADD\(CURRENT_TIMESTAMP\(\), INTERVAL 3650 DAY\)/);
  assert.doesNotMatch(sql, /INTERVAL 30 DAY/);
  assert.match(node('Compose three-topic invitation').parameters.jsCode, /These links do not expire/);
  assert.equal(dispatch.active, true, 'the export keeps the scheduled workflow active');
});

test('review pages and the dashboard preview show website fields as readable labels', () => {
  const module = read('src/shortcodes.ts');
  const pattern = new RegExp(module.match(/SHORTCODE_PATTERN = \/(.+)\/gi;/)[1], 'gi');
  const sample = 'At [sc name="practice_name"][/sc] in [hh_short name="practice_city_and_state"], call [sc name="practice_phone_number"][/sc].';
  assert.deepEqual([...sample.matchAll(pattern)].map((match) => match[1]), ['practice_name', 'practice_city_and_state', 'practice_phone_number']);
  assert.equal(sample.replace(pattern, ''), 'At  in , call .', 'each whole field, including its closing [/sc], is replaced');
  for (const label of ["practice_name: 'Practice name'", "practice_city_and_state: 'City, State'", "practice_phone_number: 'Phone number'"]) assert.ok(module.includes(label), label);
  const main = read('src/main.ts');
  assert.match(main, /labelShortcodesInDom\(document\.body, document\);\n\n  return document\.body\.innerHTML;/);
  assert.match(main, /class="shortcode-note"/);
  assert.match(client, /iframe\.srcdoc = labelShortcodesInHtml\(article\.articleHtml\)/);
});

test('the dashboard shows rows the latest doctor sync skipped, so they can be fixed in the workbook', () => {
  assert.match(admin, /event_type = 'roster\.synced'[\s\S]*?\) AS roster_sync/);
  assert.match(admin, /JSON_QUERY_ARRAY\(payload, '\$\.warnings'\)/);
  assert.match(client, /function rosterSyncNotice\(data: AdminResponse\)/);
  assert.match(client, /return `\$\{rosterSyncNotice\(data\)\}/);
});

test('a cut-off interview is flagged "too short", cannot be drafted, and the resend email can carry a note to the doctor', () => {
  assert.match(admin, /ARRAY_LENGTH\(REGEXP_EXTRACT_ALL\(TRIM\(COALESCE\(i\.transcript, ''\)\), r'\\S\+'\)\)\) AS transcript_words/);
  assert.match(client, /const MIN_INTERVIEW_WORDS = 300;/);
  assert.match(client, /if \(isTooShort\(item\)\) return 'too_short';/);
  assert.match(client, /Too short to write an article: resend the interview link/);
  assert.match(client, /if \(detailTooShort\(detail\)\) \{\n    return \{ action: null/, 'no "Write the draft now" for a too-short interview');
  assert.match(client, /name="doctor_note"[^>]*>\$\{detailTooShort\(detail\) \? escapeHtml\(CUT_OFF_NOTE\) : ''\}/);
  const source = router.nodes.find((node) => node.name === 'Validate and Normalize Command').parameters.jsCode;
  const run = (body) => new Function('$json', source)({ body: { actor_email: 'admin@apexdp.com', idempotency_key: 'abcdefghijklmnop1234', campaign_id: 'campaign_1', doctor_id: 'doctor_1', ...body } });
  assert.equal(run({ action: 'resend_interview_links', doctor_note: 'It looks like your interview got cut off.' })[0].json.doctor_note, 'It looks like your interview got cut off.');
  assert.throws(() => run({ action: 'resend_interview_links', doctor_note: 'x'.repeat(801) }), /800 characters/);
  assert.match(router.nodes.find((node) => node.name === 'Create Interview Links Again').parameters.sqlQuery, /@doctor_note AS doctor_note/);
  const compose = router.nodes.find((node) => node.name === 'Compose Interview Links Email').parameters.jsCode;
  const out = new Function('$input', compose)({ all: () => [{ json: { doctor_name: 'Dr. Test', doctor_id: 'd1', campaign_id: 'c1', campaign_name: 'January', topic_title: 'Topic', topic_sort_order: 1, interview_url: 'https://example.test/interview/1', interview_deadline: null, preview_only: false, doctor_note: 'It looks like your interview got cut off.' } }] })[0].json;
  assert.equal(JSON.parse(out.email_json).intro[0], 'It looks like your interview got cut off.');
  assert.match(out.message_text, /Hello Dr\. Test,\n\nIt looks like your interview got cut off\./);
});

test('marking an article published emails the doctor a link to the live article, and the dashboard shows it', () => {
  const live = router.nodes.find((node) => node.name === 'Record Live on Website').parameters.sqlQuery;
  assert.match(live, /'\/resources\/blog\/'/);
  assert.equal(router.connections['Return Live on Website Result'].main[0][0].node, 'Compose Article Live Email');
  assert.equal(router.connections['Compose Article Live Email'].main[0][0].node, 'Email Article Live');
  const compose = router.nodes.find((node) => node.name === 'Compose Article Live Email').parameters.jsCode;
  const email = new Function('$json', compose)({ doctor_id: 'd1', article_id: 'a1', campaign_id: 'c1', doctor_name: 'Dr. Test', practice_name: 'Audubon Dental', article_title: 'Cracked Tooth', live_url: 'https://audubondentalcare.com/resources/blog/cracked-tooth-no-pain/' })[0].json;
  assert.equal(email.communication_type, 'ARTICLE_LIVE');
  assert.match(email.message_text, /Thank you for sharing your voice and your expertise/);
  assert.match(email.message_text, /If you have ideas for future topics, just reply to this email/);
  assert.equal(JSON.parse(email.email_json).items[0].url, 'https://audubondentalcare.com/resources/blog/cracked-tooth-no-pain/');
  assert.deepEqual(new Function('$json', compose)({ live_url: '' }), [], 'no email without a valid live link');
  assert.equal(router.nodes.find((node) => node.name === 'Email Article Live').parameters.workflowId.value, 'cZtS9x6kbI46Q2Bi');
  assert.match(admin, /'\/resources\/blog\/'[\s\S]*AS live_url/);
  assert.match(client, /<dt>Live article<\/dt>/);
});

test('one article per practice per campaign: a later doctor\'s interview is held with a thank-you, and colleagues are told', () => {
  const w6 = JSON.parse(read('n8n/06-generate-article.json'));
  const n6 = (name) => w6.nodes.find((entry) => entry.name === name);
  const load = n6('Load Next Completed Interview').parameters;
  assert.match(load.sqlQuery, /QUALIFY ROW_NUMBER\(\) OVER \(PARTITION BY i2\.campaign_id, d2\.practice_id ORDER BY i2\.completed_at, i2\.interview_id\) = 1/);
  assert.match(load.sqlQuery, /first_done\.doctor_id != i\.doctor_id/);
  assert.match(load.sqlQuery, /@allow_practice_duplicate = 'true' OR p\.practice_id = 'practice_test_001'/, 'the shared test practice is exempt');
  assert.ok(load.options.queryParameters.namedParameters.some((param) => param.name === 'allow_practice_duplicate'));
  assert.ok(n6('When Executed by Another Workflow').parameters.workflowInputs.values.some((value) => value.name === 'allow_practice_duplicate'));
  assert.deepEqual(w6.connections['Load Next Completed Interview'].main[0].map((c) => c.node), ['Is Practice Already Covered?']);
  assert.deepEqual(w6.connections['Is Practice Already Covered?'].main[0].map((c) => c.node), ['Hold Interview for Practice']);
  assert.deepEqual(w6.connections['Is Practice Already Covered?'].main[1].map((c) => c.node), ['Prepare Article Generation Request', 'Find Colleagues to Notify']);
  assert.match(n6('Hold Interview for Practice').parameters.sqlQuery, /SET status = 'ON_HOLD_PRACTICE_COVERED'/);
  const held = new Function('$', n6('Compose Held Interview Email').parameters.jsCode)(() => ({ first: () => ({ json: {
    doctor_id: 'd2', doctor_name: 'Dr. Second', campaign_id: 'c1', practice_name: 'Audubon Dental', topic_title: 'Cracked teeth', covered_by_doctor_name: 'Dr. First' } }) }))[0].json;
  assert.equal(held.communication_type, 'INTERVIEW_HELD_PRACTICE_COVERED');
  assert.match(held.message_text, /Dr\. First at Audubon Dental already completed this month's interview/);
  assert.match(held.message_text, /We have saved your interview/);
  const colleagues = n6('Find Colleagues to Notify').parameters.sqlQuery;
  assert.match(colleagues, /done\.doctor_id IS NULL AND told\.doctor_id IS NULL/, 'only colleagues who have not finished, told once');
  assert.match(colleagues, /@practice_id != 'practice_test_001'/);
  const notices = new Function('$input', n6('Compose Colleague Notice').parameters.jsCode)({ all: () => [{ json: { doctor_id: 'd3', doctor_name: 'Dr. Third', campaign_id: 'c1', campaign_name: 'January', practice_name: 'Audubon Dental', covered_by_doctor_name: 'Dr. First' } }] });
  assert.equal(notices[0].json.communication_type, 'PRACTICE_COVERED_NOTICE');
  assert.match(notices[0].json.message_text, /there is nothing you need to do for January/);
  for (const name of ['Email Held Interview Thank You', 'Email Colleague Notice']) assert.equal(n6(name).parameters.mode, 'each');
  // Reminders also stop once the practice is covered (workflow 26 checks practice_covered).
  assert.match(read('n8n/26-interview-reminders.json'), /practice_covered/);
  // "Write the draft anyway" drafts a held interview on purpose.
  const check = router.nodes.find((node) => node.name === 'Check and Record Draft Request').parameters.sqlQuery;
  assert.match(check, /'ON_HOLD_PRACTICE_COVERED'\)\) = 1/);
  assert.match(check, /AS allow_practice_duplicate;/);
  assert.match(router.nodes.find((node) => node.name === 'Start Article Draft').parameters.workflowInputs.value.allow_practice_duplicate, /allow_practice_duplicate/);
  assert.match(client, /title: 'Write the draft anyway'/);
  assert.match(client, /if \(status === 'ON_HOLD_PRACTICE_COVERED'\) return 'on_hold';/);
});

test('before launch, the campaign builder checks image links and slugs and asks before launching anyway', () => {
  assert.match(worker, /url\.pathname === '\/api\/admin\/campaign-checks'/);
  assert.match(admin, /export async function handleAdminCampaignChecks/);
  assert.match(admin, /did not open as an image/);
  assert.match(admin, /was already used by an earlier campaign/);
  assert.match(admin, /\/resources\/blog\/\$\{slug\}\//);
  assert.match(admin, /finalPath\.endsWith\(`\/resources\/blog\/\$\{page\.slug\}`\)/, 'a redirect to the blog list is not a match');
  assert.match(admin, /could not be checked for an existing page/);
  assert.match(admin, /!actionEmails\(adminEnv\)\.includes\(viewer\.email\)\) return Response\.json\(\{ error: 'FORBIDDEN'/);
  assert.match(client, /fetch\('\/api\/admin\/campaign-checks'/);
  assert.match(client, /click the launch button once more to launch anyway/);
  assert.match(client, /form\.dataset\.checkedLaunch !== checksKey/);
});
