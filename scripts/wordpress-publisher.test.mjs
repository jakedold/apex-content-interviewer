import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const workflow = JSON.parse(fs.readFileSync(new URL('../n8n/15-publish-approved-article-to-wordpress.json', import.meta.url), 'utf8'));
const source = workflow.nodes.find((node) => node.name === 'Prepare WordPress Publication').parameters.jsCode;
const prepare = new Function('$json', source);
const launcher = JSON.parse(fs.readFileSync(new URL('../n8n/01-launch-campaign.json', import.meta.url), 'utf8'));
const testLauncher = JSON.parse(fs.readFileSync(new URL('../n8n/01-test-only-campaign-launcher.json', import.meta.url), 'utf8'));
const qaHarness = JSON.parse(fs.readFileSync(new URL('../n8n/23-run-exact-pilot-wordpress-qa.json', import.meta.url), 'utf8'));
const row = (config) => ({
  article_id: 'article_test',
  practice_id: 'practice_test_001',
  publisher_type: 'WORDPRESS',
  publisher_config_reference: JSON.stringify(config),
  website_domain: 'https://public-dental.test',
  doctor_name: 'Dr. Test',
  practice_name: 'Test Dental',
  topic_id: 'topic_test_cleaning',
  featured_image_source_url: 'https://apexparent.hostmanpowered.com/wp-content/uploads/2026/09/cleaning.png',
  featured_image_alt_text: 'Dentist talking with a patient',
  publication_package_json: JSON.stringify({
    metadata: {
      h1: 'Test article',
      seo_title: 'A useful test article for dental patients',
      slug: 'test-article',
      meta_description: 'This test summary explains a useful dental topic clearly, accurately, and concisely so patients know what to discuss at their next visit.',
      focus_keyphrase: 'useful dental article',
    },
    article_html: '<h1>Test article</h1><p>Schedule at {{APPOINTMENT_URL}}</p><h2>Frequently asked questions</h2><h3>Question one?</h3><p>Answer.</p><h3>Question two?</h3><p>Answer.</p><h3>Question three?</h3><p>Answer.</p>',
  }),
});

test('WordPress API uses explicit editing-site URL, while links use the public site', () => {
  const result = prepare(row({ credential_name: 'Wordpress account', wordpress_base_url: 'https://apexparent.hostmanpowered.com/test001/' }))[0].json;
  assert.equal(result.wordpress_api_url, 'https://apexparent.hostmanpowered.com/test001/wp-json/wp/v2');
  assert.match(result.content, /https:\/\/public-dental\.test/);
  assert.match(result.content, /class="article-byline"/);
  assert.match(result.content, /class="article-doctor-profile"/);
  assert.ok(result.content.indexOf('article-doctor-profile') < result.content.indexOf('Frequently asked questions'));
  assert.doesNotMatch(result.wordpress_api_url, /public-dental/);
});

test('mapped doctor profile and central campaign image are prepared for automatic upload', () => {
  const candidate = row({ credential_name: 'Wordpress account', wordpress_base_url: 'https://apexparent.hostmanpowered.com/test001/' });
  candidate.doctor_profile_url = 'https://public-dental.test/doctors/dr-test';
  candidate.doctor_photo_url = 'https://apexparent.hostmanpowered.com/test001/wp-content/uploads/dr-test.jpg';
  candidate.doctor_short_bio = 'Dr. Test provides preventive dental care.';
  const result = prepare(candidate)[0].json;
  assert.match(result.content, /Dr\. Test provides preventive dental care/);
  assert.match(result.content, /Read more about Dr\. Test/);
  assert.equal(result.featured_image_source_url, 'https://apexparent.hostmanpowered.com/wp-content/uploads/2026/09/cleaning.png');
  assert.equal(result.featured_image_upload_filename, 'aac-topic-test-cleaning.png');
  assert.equal(result.wordpress_body.featured_media, undefined);
});

test('publishing refreshes stale byline and doctor profile from the verified mapping', () => {
  const candidate = row({ credential_name: 'Wordpress account', wordpress_base_url: 'https://apexparent.hostmanpowered.com/test001/' });
  candidate.doctor_profile_url = 'https://public-dental.test/doctors/dr-test';
  candidate.doctor_photo_url = 'https://public-dental.test/uploads/dr-test.jpg';
  candidate.doctor_short_bio = 'Dr. Test provides preventive dental care.';
  const pkg = JSON.parse(candidate.publication_package_json);
  pkg.article_html = pkg.article_html.replace(
    '<h1>Test article</h1>',
    '<h1>Test article</h1><p class="article-byline">By <strong>Dr. Old</strong></p>',
  ).replace(
    '<h2>Frequently asked questions</h2>',
    '<section class="article-doctor-profile"><h2>About Dr. Old</h2><p>Outdated test bio.</p></section><h2>Frequently asked questions</h2>',
  );
  candidate.publication_package_json = JSON.stringify(pkg);

  const result = prepare(candidate)[0].json;
  assert.equal((result.content.match(/article-byline/g) || []).length, 1);
  assert.equal((result.content.match(/article-doctor-profile/g) || []).length, 1);
  assert.match(result.content, /By <strong>Dr\. Test<\/strong>/);
  assert.match(result.content, /Dr\. Test provides preventive dental care/);
  assert.doesNotMatch(result.content, /Dr\. Old|Outdated test bio/);
});

test('publisher removes a matching unclassified leading byline before adding the canonical byline', () => {
  const candidate = row({ credential_name: 'Wordpress account', wordpress_base_url: 'https://apexparent.hostmanpowered.com/test001/' });
  const pkg = JSON.parse(candidate.publication_package_json);
  pkg.article_html = pkg.article_html.replace(
    '<h1>Test article</h1>',
    '<h1>Test article</h1><p>By Dr. Test</p>',
  );
  candidate.publication_package_json = JSON.stringify(pkg);

  const result = prepare(candidate)[0].json;
  const renderedText = result.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.equal((renderedText.match(/By Dr\. Test/g) || []).length, 1);
  assert.match(result.content, /^<p class="article-byline">By <strong>Dr\. Test<\/strong><\/p>/);
});

test('publisher query prefers the verified workbook profile name and credentials', () => {
  const load = workflow.nodes.find((node) => node.name === 'Load Approved WordPress Article');
  assert.match(load.parameters.sqlQuery, /COALESCE\(NULLIF\(TRIM\(dp\.doctor_name\), ''\), d\.doctor_name\) AS doctor_name/);
  assert.match(load.parameters.sqlQuery, /COALESCE\(NULLIF\(TRIM\(dp\.credentials\), ''\), d\.credentials\) AS credentials/);
});

test('QA republish is restricted to the exact existing pilot post', () => {
  const load = workflow.nodes.find((node) => node.name === 'Load Approved WordPress Article');
  assert.match(load.parameters.sqlQuery, /LOWER\(@qa_republish\) = 'true'/);
  assert.match(load.parameters.sqlQuery, /article_6296aabf938f492eafd5a2b010b3f8c9/);
  assert.match(load.parameters.sqlQuery, /campaign_test_202609_aac_prestonwood_pilot_2026_09_23/);
  assert.match(load.parameters.sqlQuery, /pr\.external_post_id = '9988'/);
  assert.match(load.parameters.sqlQuery, /LOWER\(d\.email\) = 'jdold@apexdp\.com'/);
  const parameters = load.parameters.options.queryParameters.namedParameters;
  assert.equal(parameters.find((entry) => entry.name === 'qa_republish').value, '={{ String($json.qa_republish ?? false) }}');
  const trigger = workflow.nodes.find((node) => node.name === 'When Executed by Another Workflow');
  assert.deepEqual(trigger.parameters.workflowInputs.values, [
    { name: 'article_id' },
    { name: 'qa_republish', type: 'boolean' },
  ]);
});

test('QA harness is inactive, exact-scope, and calls only the revised publisher', () => {
  assert.equal(qaHarness.active, undefined);
  const scope = qaHarness.nodes.find((node) => node.name === 'Scope to Exact Pilot Article');
  assert.match(scope.parameters.jsCode, /article_6296aabf938f492eafd5a2b010b3f8c9/);
  assert.match(scope.parameters.jsCode, /qa_republish: true/);
  const call = qaHarness.nodes.find((node) => node.name === 'Run Revised Publisher for Exact Pilot');
  assert.equal(call.parameters.workflowId.value, 'IAZwCVXtPGN97BnC');
  assert.deepEqual(call.parameters.workflowInputs.value, {
    article_id: '={{ $json.article_id }}',
    qa_republish: '={{ $json.qa_republish }}',
  });
  assert.equal(qaHarness.nodes.some((node) => /email|gmail|send/i.test(node.type)), false);
});

test('the exact legacy pilot alone receives bounded SEO fallback metadata', () => {
  const candidate = row({ credential_name: 'Wordpress account', wordpress_base_url: 'https://apexparent.hostmanpowered.com/test001/' });
  candidate.qa_republish = true;
  candidate.article_id = 'article_6296aabf938f492eafd5a2b010b3f8c9';
  candidate.campaign_id = 'campaign_test_202609_aac_prestonwood_pilot_2026_09_23';
  candidate.doctor_email = 'jdold@apexdp.com';
  const pkg = JSON.parse(candidate.publication_package_json);
  pkg.metadata = {};
  candidate.publication_package_json = JSON.stringify(pkg);
  const result = prepare(candidate)[0].json;
  assert.equal(result.slug, 'do-you-need-two-dental-cleanings-a-year');
  assert.equal(result.focus_keyphrase, 'dental cleaning frequency');
  assert.ok(result.excerpt.length >= 120 && result.excerpt.length <= 165);

  candidate.article_id = 'article_other';
  assert.throws(() => prepare(candidate), /missing its title, SEO title, slug, meta description, or focus keyphrase/);
});

test('approved legacy packages derive a bounded focus keyphrase from their validated slug', () => {
  const candidate = row({ credential_name: 'Wordpress account', wordpress_base_url: 'https://apexparent.hostmanpowered.com/test001/' });
  const pkg = JSON.parse(candidate.publication_package_json);
  pkg.metadata.slug = 'tooth-sensitivity-causes-treatment';
  delete pkg.metadata.focus_keyphrase;
  candidate.publication_package_json = JSON.stringify(pkg);
  const result = prepare(candidate)[0].json;
  assert.equal(result.focus_keyphrase, 'tooth sensitivity causes treatment');
});

test('automatic publication rejects an unverified practice even with a WordPress URL', () => {
  const candidate = row({ credential_name: 'Wordpress account', wordpress_base_url: 'https://apexparent.hostmanpowered.com/test001/' });
  candidate.practice_id = 'practice_other';
  assert.throws(() => prepare(candidate), /restricted to the TEST-1 practice/);
});

test('featured image may come from one central asset library', () => {
  const candidate = row({ credential_name: 'Wordpress account', wordpress_base_url: 'https://apexparent.hostmanpowered.com/test001/' });
  candidate.featured_image_source_url = 'https://apexparent.hostmanpowered.com/wp-content/uploads/2026/09/cleaning.webp';
  const result = prepare(candidate)[0].json;
  assert.equal(result.featured_image_source_url, candidate.featured_image_source_url);
  assert.equal(result.featured_image_upload_filename, 'aac-topic-test-cleaning.webp');
});

test('workflow downloads and uploads the selected image into the target subsite', () => {
  const download = workflow.nodes.find((node) => node.name === 'Download Selected Campaign Image');
  const upload = workflow.nodes.find((node) => node.name === 'Upload Campaign Image to Target WordPress');
  const attach = workflow.nodes.find((node) => node.name === 'Attach Uploaded Campaign Image');
  assert.equal(download.parameters.url, '={{ $json.featured_image_source_url }}');
  assert.match(upload.parameters.url, /wordpress_api_url \+ '\/media'/);
  assert.equal(upload.parameters.contentType, 'binaryData');
  assert.match(attach.parameters.jsCode, /featured_media: Number\(media\.id\)/);
  assert.match(attach.parameters.jsCode, /article-featured-image/);
});

test('retry reuses a deterministic target-media slug instead of uploading again', () => {
  const choose = workflow.nodes.find((node) => node.name === 'Choose Existing or New Topic Image');
  const run = new Function('$input', '$', choose.parameters.jsCode);
  const context = { featured_image_media_slug: 'aac-topic-test-cleaning' };
  const media = { id: 42, slug: context.featured_image_media_slug, mime_type: 'image/png', source_url: 'https://apexparent.hostmanpowered.com/test001/wp-content/uploads/cleaning.png' };
  const result = run({ all: () => [{ json: [media] }] }, () => ({ first: () => ({ json: context }) }))[0].json;
  assert.equal(result.media_exists, true);
  assert.equal(result.reusable_media.id, 42);
  assert.equal(workflow.connections['If Topic Image Already Exists'].main[0][0].node, 'Reuse Existing Topic Image');
  assert.equal(workflow.connections['If Topic Image Already Exists'].main[1][0].node, 'Download Selected Campaign Image');
});

test('publisher rejects image sources outside the designated central library', () => {
  const candidate = row({ credential_name: 'Wordpress account', wordpress_base_url: 'https://apexparent.hostmanpowered.com/test001/' });
  candidate.featured_image_source_url = 'https://unapproved.example.org/cleaning.png';
  assert.throws(() => prepare(candidate), /designated Apex Parent central Media Library/);
});

test('campaign launcher validates central URLs rather than pre-existing subsite media', () => {
  const validation = launcher.nodes.find((node) => node.name === 'Validate campaign details').parameters.jsCode;
  assert.match(validation, /featured_image_source_url/);
  assert.doesNotMatch(validation, /featured_image_media_(?:id|url)/);
  assert.match(validation, /three topics with central image records/);
});

test('test launcher normalizes Apex Parent media URLs and reports specific validation errors', () => {
  const validation = testLauncher.nodes.find((node) => node.name === 'Preview selection without sending').parameters.jsCode;
  assert.match(validation, /\^https\?:\\\/\\\/apexparent/);
  assert.match(validation, /return 'https:\/\/apexparent\.hostmanpowered\.com'/);
  assert.doesNotMatch(validation, /new URL\(/);
  assert.match(validation, /apexparent\.hostmanpowered\.com/);
  assert.ok(validation.includes('\\/wp-content\\/uploads\\/'));
  assert.match(validation, /Topic ' \+ number \+ ' needs a featured image URL/);
  assert.doesNotMatch(validation, /Enter a campaign name, month, and three distinct topics/);
});

test('publication fails closed without a separate WordPress subsite URL', () => {
  assert.throws(() => prepare(row({ credential_name: 'Wordpress account' })), /WordPress multisite subsite base URL/);
});
