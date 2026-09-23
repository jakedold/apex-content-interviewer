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
  assert.throws(() => prepare(candidate), /restricted to the TEST-1 practice/);
});

test('publication fails closed without a separate WordPress subsite URL', () => {
  assert.throws(() => prepare(row({ credential_name: 'Wordpress account' })), /WordPress multisite subsite base URL/);
});
