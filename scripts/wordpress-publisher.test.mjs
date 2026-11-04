import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const workflow = JSON.parse(fs.readFileSync(new URL('../n8n/15-publish-approved-article-to-wordpress.json', import.meta.url), 'utf8'));
const source = workflow.nodes.find((node) => node.name === 'Prepare WordPress Publication').parameters.jsCode;
const prepare = new Function('$json', source);
const row = (config) => ({
  article_id: 'article_test',
  practice_id: 'practice_test_001',
  publisher_type: 'WORDPRESS',
  publisher_config_reference: JSON.stringify(config),
  website_domain: 'https://public-dental.test',
  featured_image_source_url: 'https://apexparent.hostmanpowered.com/wp-content/uploads/test-featured.jpg',
  featured_image_alt_text: 'A dental team discussing care',
  doctor_name: 'Dr. Test',
  practice_name: 'Test Dental',
  publication_package_json: JSON.stringify({
    metadata: { h1: 'Test article', slug: 'test-article', meta_description: 'Test summary' },
    article_html: '<h1>Test article</h1><p>Schedule at {{APPOINTMENT_URL}}</p>',
  }),
});

test('WordPress API uses explicit editing-site URL, while links use the public site', () => {
  const result = prepare(row({ credential_name: 'Wordpress account', wordpress_base_url: 'https://apexparent.hostmanpowered.com/test001/' }))[0].json;
  assert.equal(result.wordpress_api_url, 'https://apexparent.hostmanpowered.com/test001/wp-json/wp/v2');
  assert.match(result.content, /https:\/\/public-dental\.test/);
  assert.doesNotMatch(result.wordpress_api_url, /public-dental/);
});

test('automatic publication rejects an unverified practice even with a WordPress URL', () => {
  const candidate = row({ credential_name: 'Wordpress account', wordpress_base_url: 'https://apexparent.hostmanpowered.com/test001/' });
  candidate.practice_id = 'practice_other';
  assert.throws(() => prepare(candidate), /VERIFIED practice-to-WordPress mapping/);
});

test('publication fails closed without a separate WordPress subsite URL', () => {
  assert.throws(() => prepare(row({ credential_name: 'Wordpress account' })), /WordPress multisite subsite base URL/);
});

const verifiedConfig = { credential_name: 'Wordpress account', wordpress_base_url: 'https://apexparent.hostmanpowered.com/test001/' };

test('a campaign topic WordPress slug overrides the writer-recommended slug', () => {
  const candidate = { ...row(verifiedConfig), topic_wordpress_slug: 'why-brushing-before-bed-matters' };
  const result = prepare(candidate)[0].json;
  assert.equal(result.slug, 'why-brushing-before-bed-matters');
  assert.equal(result.wordpress_body.slug, 'why-brushing-before-bed-matters');
  assert.equal(result.article_slug_base, 'why-brushing-before-bed-matters');
  assert.match(result.article_slug_collision, /^why-brushing-before-bed-matters-article-/);
});

test('without a topic slug the writer-recommended slug is still used', () => {
  const result = prepare(row(verifiedConfig))[0].json;
  assert.equal(result.slug, 'test-article');
});

test('an invalid topic slug fails closed instead of publishing an unexpected URL', () => {
  assert.throws(() => prepare({ ...row(verifiedConfig), topic_wordpress_slug: 'Bad Slug!' }), /WordPress URL slug/);
});

test('the publisher loads the topic slug from the campaign topic', () => {
  const query = workflow.nodes.find((node) => node.name === 'Load Approved WordPress Article').parameters.query
    ?? workflow.nodes.find((node) => node.name === 'Load Approved WordPress Article').parameters.sqlQuery;
  assert.match(query, /'\$\.wordpress_slug'\) AS topic_wordpress_slug/);
});

test('the doctor bio sits in the left sidebar directly under the FAQ, not below the article', () => {
  const layoutSource = workflow.nodes.find((node) => node.name === 'Set Featured Image and Prepare Post').parameters.jsCode;
  const candidate = row(verifiedConfig);
  candidate.photo_source_url = 'https://public-dental.test/doctor.jpg';
  candidate.profile_url = 'https://public-dental.test/about';
  candidate.publication_package_json = JSON.stringify({
    metadata: { h1: 'Test article', slug: 'test-article', meta_description: 'Test summary' },
    author_bio: 'Dr. Test is a placeholder dentist used only in this automated layout test.',
    article_html: '<h1>Test article</h1><p>Body</p><section class="aac-article-faq"><h2>FAQ</h2><p>Answer</p></section><p>Schedule at {{APPOINTMENT_URL}}</p>',
  });
  const prepared = prepare(candidate)[0].json;
  const $ = () => ({ first: () => ({ json: prepared }) });
  const content = new Function('$json', '$', layoutSource)({ id: 7, source_url: 'https://apexparent.hostmanpowered.com/wp-content/uploads/test.jpg' }, $)[0].json.content;
  const sidebar = content.match(/<aside class="aac-article-sidebar"[\s\S]*<\/aside>/)?.[0] || '';
  assert.ok(sidebar.indexOf('aac-article-faq') > -1 && sidebar.indexOf('aac-author-bio-card') > sidebar.indexOf('aac-article-faq'));
  assert.equal(content.match(/About Dr\. Test/g).length, 1);
  assert.ok(content.trim().endsWith('</aside></div>'));
  assert.match(sidebar, /View full bio/);
  assert.match(sidebar, /href="https:\/\/public-dental\.test" target="_blank" rel="noopener">Book appointment/);
  assert.match(content, /\.aac-article-sidebar\{grid-column:1!important/);
});
