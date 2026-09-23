import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const workflow = JSON.parse(fs.readFileSync(new URL('../n8n/01-test-entries-preview.json', import.meta.url), 'utf8'));
const source = workflow.nodes.find((node) => node.name === 'Validate test-only entries').parameters.jsCode;
const preview = new Function('$input', source);
const runPreview = (json) => preview({ first: () => ({ json }) });

test('test-entry workflow is inactive and has no send, database, or publishing nodes', () => {
  assert.equal(workflow.active, false);
  assert.equal(workflow.nodes.some((node) => node.credentials), false);
  assert.deepEqual(workflow.nodes.map((node) => node.type).sort(), [
    'n8n-nodes-base.code',
    'n8n-nodes-base.formTrigger',
    'n8n-nodes-base.stickyNote',
  ]);
  assert.equal(workflow.nodes.find((node) => node.name === 'Validate test-only entries').parameters.mode, 'runOnceForAllItems');
});

test('test practices and recipients stay in a separate preview-only result', () => {
  const result = runPreview({ test_practices: 'TEST001 | https://test.example.org', test_emails: 'person@example.org' })[0].json;
  assert.equal(result.mode, 'TEST_PREVIEW_ONLY');
  assert.equal(result.preview_only, true);
  assert.equal(result.practice_count, 1);
  assert.equal(result.recipient_count, 1);
  assert.equal(result.test_recipients[0].practice_name, 'TEST001');
  assert.match(result.message, /No email sent/);
});

test('test preview rejects duplicate recipients and non-HTTPS sites', () => {
  assert.throws(() => runPreview({ test_practices: 'TEST001 | http://test.example.org', test_emails: 'person@example.org' }), /HTTPS/);
  assert.throws(() => runPreview({ test_practices: 'TEST001', test_emails: 'person@example.org\nperson@example.org' }), /only once/);
});
