import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const workflow = JSON.parse(fs.readFileSync(new URL('../n8n/01-roster-selection-preview.json', import.meta.url), 'utf8'));

test('selection preview is inactive, credential-free, and incapable of sending or publishing', () => {
  assert.equal(workflow.active, false);
  assert.equal(workflow.nodes.some((node) => node.credentials), false);
  assert.equal(workflow.nodes.filter((node) => node.type === 'n8n-nodes-base.googleSheets').length, 5);
  const readers = workflow.nodes.filter((node) => node.type === 'n8n-nodes-base.googleSheets');
  assert.deepEqual(new Set(readers.map((node) => node.parameters.documentId.value)), new Set(['1M0arM4jnZzalySGUKq60Hp1yhTDz2RQTXqMeOWfaOUA']));
  assert.deepEqual(new Set(readers.map((node) => node.parameters.sheetName.value)), new Set(['Locations', 'Wordpress Sites', 'Doctor Census', 'Test User']));
  assert.deepEqual(readers.filter((node) => node.parameters.sheetName.value === 'Doctor Census').map((node) => node.parameters.options.dataLocationOnSheet.values.range).sort(), ['A2:D250', 'I2:I250']);
  assert.equal(workflow.nodes.filter((node) => node.type === 'n8n-nodes-base.form').length, 2);
  const formPages = workflow.nodes.filter((node) => node.type === 'n8n-nodes-base.form');
  assert.ok(formPages.every((node) => node.typeVersion === 2.3));
  assert.ok(formPages.every((node) => !/fieldName|defaultValue|requiredField/.test(node.parameters.jsonOutput)));
  assert.match(formPages.find((node) => node.name === 'Choose locations').parameters.jsonOutput, /Locations to exclude/);
  assert.match(formPages.find((node) => node.name === 'Choose doctors').parameters.jsonOutput, /Recipients to exclude/);
  assert.equal(workflow.nodes.some((node) => ['n8n-nodes-base.googleBigQuery', 'n8n-nodes-base.gmail', 'n8n-nodes-base.httpRequest'].includes(node.type)), false);
  const names = new Set(workflow.nodes.map((node) => node.name));
  for (const edges of Object.values(workflow.connections)) {
    for (const outputs of edges.main) for (const edge of outputs) assert.equal(names.has(edge.node), true);
  }
  for (const node of workflow.nodes.filter((item) => item.type === 'n8n-nodes-base.code')) {
    new Function('$', '$input', node.parameters.jsCode);
  }
  const trigger = workflow.nodes.find((node) => node.type === 'n8n-nodes-base.formTrigger');
  assert.ok(trigger.parameters.formFields.values.some((field) => field.fieldName === 'audience'));
  assert.match(workflow.nodes.find((node) => node.name === 'Validate current roster').parameters.jsCode, /Test users only/);
});
