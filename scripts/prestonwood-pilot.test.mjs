import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const campaignId = 'campaign_test_202609_aac_prestonwood_pilot_2026_09_23';
const load = (name) => JSON.parse(readFileSync(`n8n/${name}.json`, 'utf8'));
const node = (workflow, name) => workflow.nodes.find((item) => item.name === name);
const execute = (code, input) => runInNewContext(`(() => { ${code} })()`, { $json: input });

const publisher = load('15-publish-approved-article-to-wordpress');
const prepare = node(publisher, 'Prepare WordPress Publication').parameters.jsCode;
const publicationPackage = {
  metadata: { h1: 'Pilot title', slug: 'pilot-slug', meta_description: 'Pilot excerpt' },
  article_html: '<h1>Pilot title</h1><p>Call {{PRACTICE_NAME}} at {{APPOINTMENT_URL}}.</p>',
};
const row = (overrides = {}) => ({
  article_id: 'article_test', campaign_id: campaignId,
  practice_id: 'practice_test_001', doctor_email: 'jdold@apexdp.com',
  doctor_name: 'Dr. Dold', credentials: 'DDS',
  publisher_type: 'WORDPRESS', website_domain: 'https://test.example.test',
  publisher_config_reference: JSON.stringify({
    credential_name: 'Wordpress account',
    wordpress_base_url: 'https://apexparent.hostmanpowered.com/test001',
  }),
  publication_package_json: JSON.stringify(publicationPackage),
  ...overrides,
});

test('only the exact campaign and test identity route to Prestonwood', () => {
  const pilot = execute(prepare, row())[0].json;
  assert.equal(pilot.wordpress_api_url, 'https://apexparent.hostmanpowered.com/dfw-03/wp-json/wp/v2');
  assert.match(pilot.content, /prestonwooddentistry\.com/);
  assert.equal(pilot.wordpress_body.status, 'publish');
  const ordinary = execute(prepare, row({ campaign_id: 'campaign_test_other' }))[0].json;
  assert.equal(ordinary.wordpress_api_url, 'https://apexparent.hostmanpowered.com/test001/wp-json/wp/v2');
  assert.throws(() => execute(prepare, row({ doctor_email: 'other@apexdp.com' })), /named test identity/);
  assert.throws(() => execute(prepare, row({ practice_id: 'practice_dfw_03' })), /TEST-1 practice/);
  assert.throws(() => execute(prepare, row({ publisher_config_reference: JSON.stringify({ credential_name: 'Wordpress account', wordpress_base_url: 'https://apexparent.hostmanpowered.com/dfw-03' }) })), /TEST-1 practice/);
});

test('marketing invitation stays with Jake for the pilot', () => {
  const marketing = load('18-send-marketing-review-invitation');
  const email = node(marketing, 'Prepare Marketing Review Email').parameters.jsCode;
  const input = { article_id: 'article_test', campaign_id: campaignId, doctor_email: 'jdold@apexdp.com', article_title: 'Pilot', review_url: 'https://example.test/review' };
  const pilot = execute(email, input).json;
  assert.equal(pilot.recipient, 'jdold@apexdp.com');
  assert.equal(pilot.cc_list, '');
  const ordinary = execute(email, { ...input, campaign_id: 'campaign_test_other' }).json;
  assert.equal(ordinary.recipient, 'ndorsey@apexdp.com');
  assert.match(ordinary.cc_list, /ballen@apexdp\.com/);
  assert.throws(() => execute(email, { ...input, doctor_email: 'other@apexdp.com' }), /named test identity/);
  assert.equal(node(marketing, 'Email Marketing Reviewer').parameters.options.ccList, '={{ $json.cc_list }}');
});

test('article prompts use Prestonwood context for this campaign', () => {
  const generation = node(load('06-generate-article'), 'Prepare Article Generation Request').parameters.jsCode;
  const revision = node(load('10-revise-article-from-doctor-feedback'), 'Prepare Revision Request').parameters.jsCode;
  for (const code of [generation, revision]) {
    assert.match(code, /Prestonwood Family Dentistry/);
    assert.match(code, /prestonwooddentistry\.com/);
    assert.match(code, /doctor_jdold_apexdp_com/);
    assert.match(code, /practice_test_001/);
  }
});
