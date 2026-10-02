import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflow = JSON.parse(
  fs.readFileSync(path.join(root, 'n8n', '02-dispatch-campaign-invitations.json'), 'utf8'),
);
const node = workflow.nodes.find((item) => item.name === 'Create three topic links');
const sql = String(node?.parameters?.sqlQuery || '');

test('the one-minute dispatcher never performs schema migration work', () => {
  assert.ok(node, 'dispatcher link-creation node should exist');
  assert.doesNotMatch(sql, /ALTER\s+TABLE/i);
  assert.match(sql, /^UPDATE `apex-marketing-n8n\.automated_article_creation\.campaigns`/);
});

test('the dispatcher keeps its send recovery and duplicate protection', () => {
  assert.match(sql, /status = 'SENDING'/);
  assert.match(sql, /communication_type = 'CAMPAIGN_INVITATION'/);
  assert.match(sql, /status = 'SENT'/);
  assert.match(sql, /status = 'SUPERSEDED'/);
});

test('the dispatcher retains a one-minute schedule', () => {
  const trigger = workflow.nodes.find((item) => item.name === 'Check for due invitations every minute');
  assert.equal(trigger?.parameters?.rule?.interval?.[0]?.expression, '* * * * *');
});
