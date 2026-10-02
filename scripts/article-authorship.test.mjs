import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const load = (file) => JSON.parse(fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));

test('doctor profiles are synced into durable author fields', () => {
  const workflow = load('n8n/25-sync-doctor-census.json');
  assert.ok(workflow.nodes.some((node) => node.name === 'Read doctor profiles'));
  const prepare = workflow.nodes.find((node) => node.name === 'Prepare Current Census Roster').parameters.jsCode;
  const sync = workflow.nodes.find((node) => node.name === 'Sync Census to BigQuery').parameters.sqlQuery;
  assert.match(prepare, /Short Bio/);
  assert.match(prepare, /Every active Doctor Profiles row needs Work Email, Doctor Name, Credentials, and Short Bio/);
  for (const field of ['author_name', 'author_bio', 'profile_url', 'photo_source_url', 'profile_verified_at']) {
    assert.match(sync, new RegExp(field));
  }
});

test('generation and revision workflows enforce visible verified authorship', () => {
  for (const [file, loadName, prepareName, validateName] of [
    ['n8n/06-generate-article.json', 'Load Next Completed Interview', 'Prepare Article Generation Request', 'Validate and Parse Article Package'],
    ['n8n/10-revise-article-from-doctor-feedback.json', 'Load Requested Revision', 'Prepare Revision Request', 'Validate Revised Package'],
    ['n8n/20-revise-article-from-marketing-feedback.json', 'Load Marketing Revision Request', 'Prepare Marketing Revision Request', 'Validate Marketing Revision'],
  ]) {
    const workflow = load(file);
    const query = workflow.nodes.find((node) => node.name === loadName).parameters.sqlQuery;
    const prepare = workflow.nodes.find((node) => node.name === prepareName).parameters.jsCode;
    const validate = workflow.nodes.find((node) => node.name === validateName).parameters.jsCode;
    assert.match(query, /d\.author_bio/);
    assert.match(prepare, /Doctor Profiles row must be completed and marked Active/);
    assert.match(prepare, /required: \['article_html', 'author_bio'/);
    assert.match(validate, /<strong>By /);
    assert.match(validate, /<h2>About /);
    assert.match(validate, /AAC_AUTHOR_BYLINE_START/);
    assert.match(validate, /AAC_AUTHOR_BIO_START/);
    assert.match(validate, /publicationPackage\.author_bio/);
  }
});

test('WordPress keeps authored content but removes internal author markers', () => {
  const workflow = load('n8n/15-publish-approved-article-to-wordpress.json');
  const prepare = workflow.nodes.find((node) => node.name === 'Prepare WordPress Publication').parameters.jsCode;
  assert.match(prepare, /AAC_AUTHOR_\(\?:BYLINE\|BIO\)/);
});
