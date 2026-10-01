import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, 'n8n', file), 'utf8'));
const sql = (file, nodeName) => {
  const node = read(file).nodes.find((candidate) => candidate.name === nodeName);
  assert.ok(node, `${file} is missing ${nodeName}`);
  return node.parameters.sqlQuery;
};

const guardedNodes = [
  ['06-generate-article.json', 'Load Next Completed Interview'],
  ['07-create-doctor-review-link.json', 'Generate and Store Secure Review Link'],
  ['10-revise-article-from-doctor-feedback.json', 'Load Requested Revision'],
  ['12-route-to-marketing-review.json', 'Route Approved Article'],
  ['18-send-marketing-review-invitation.json', 'Prepare Fresh Marketing Review Link'],
  ['20-revise-article-from-marketing-feedback.json', 'Load Marketing Revision Request'],
];

test('every production article stage accepts only test or verified configured practices', () => {
  for (const [file, node] of guardedNodes) {
    const query = sql(file, node);
    assert.match(query, /p\.active = TRUE/, file);
    assert.match(query, /publisher_type[\s\S]*WORDPRESS/, file);
    assert.match(query, /wordpress_base_url/, file);
    assert.match(query, /credential_name/, file);
    assert.match(query, /mapping_status[\s\S]*VERIFIED/, file);
    assert.doesNotMatch(query, /AND (?:a|d)\.practice_id = 'practice_test_001'/, file);
  }
});

test('the existing five-day doctor auto-approval remains enabled', () => {
  const query = sql('11-auto-approve-expired-doctor-reviews.json', 'Auto-Approve Expired Doctor Reviews');
  assert.match(query, /ap\.status = 'PENDING'/);
  assert.match(query, /a\.status = 'DOCTOR_REVIEW_PENDING'/);
  assert.doesNotMatch(query, /require_explicit_doctor_approval/);
});

test('WordPress publishing remains separate from any Headless Hostman release', () => {
  for (const file of fs.readdirSync(path.join(root, 'n8n')).filter((name) => /^\d+.*\.json$/.test(name))) {
    const workflow = read(file);
    const outboundUrls = workflow.nodes
      .filter((node) => node.type === 'n8n-nodes-base.httpRequest')
      .map((node) => String(node.parameters?.url ?? ''));
    for (const url of outboundUrls) {
      assert.ok(!/hostman/i.test(url) || !/(?:deploy|build|release)/i.test(url), `${file}: ${url}`);
    }
  }
});
