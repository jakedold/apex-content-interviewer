import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const workflow = JSON.parse(fs.readFileSync(new URL('../n8n/01-roster-selection-preview.json', import.meta.url), 'utf8'));

test('selection preview is inactive, credential-free, and incapable of sending or publishing', () => {
  assert.equal(workflow.active, false);
  assert.equal(workflow.nodes.some((node) => node.credentials), false);
  assert.equal(workflow.nodes.filter((node) => node.type === 'n8n-nodes-base.googleSheets').length, 4);
  assert.equal(workflow.nodes.filter((node) => node.type === 'n8n-nodes-base.form').length, 2);
  assert.equal(workflow.nodes.some((node) => ['n8n-nodes-base.googleBigQuery', 'n8n-nodes-base.gmail', 'n8n-nodes-base.httpRequest'].includes(node.type)), false);
  const names = new Set(workflow.nodes.map((node) => node.name));
  for (const edges of Object.values(workflow.connections)) {
    for (const outputs of edges.main) for (const edge of outputs) assert.equal(names.has(edge.node), true);
  }
  for (const node of workflow.nodes.filter((item) => item.type === 'n8n-nodes-base.code')) {
    new Function('$', '$input', node.parameters.jsCode);
  }
});
