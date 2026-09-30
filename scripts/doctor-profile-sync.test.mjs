import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const workflow = JSON.parse(fs.readFileSync(new URL('../n8n/21-sync-doctor-profiles-from-sheet.json', import.meta.url), 'utf8'));
const validation = workflow.nodes.find((node) => node.name === 'Validate TEST-1 Profile').parameters.jsCode;
const sync = workflow.nodes.find((node) => node.name === 'Upsert TEST-1 Profile in BigQuery');

test('doctor profile sync is manual, inactive, and restricted to TEST-1', () => {
  assert.equal(workflow.active, false);
  assert.ok(workflow.nodes.some((node) => node.type === 'n8n-nodes-base.manualTrigger'));
  assert.match(validation, /jdold@apexdp\.com/);
  assert.match(validation, /Exactly one active TEST-1 doctor profile/);
  assert.match(sync.parameters.sqlQuery, /practice_test_001/);
  assert.match(sync.parameters.sqlQuery, /@location_code = 'TEST-1'/);
});

test('doctor profile sync uses the workbook as input and BigQuery as the runtime record', () => {
  const sheet = workflow.nodes.find((node) => node.name === 'Read Doctor Profiles');
  assert.equal(sheet.parameters.sheetName.value, 'Doctor Profiles');
  assert.equal(sheet.parameters.documentId.value, '1M0arM4jnZzalySGUKq60Hp1yhTDz2RQTXqMeOWfaOUA');
  assert.match(sync.parameters.sqlQuery, /MERGE `apex-marketing-n8n\.automated_article_creation\.doctor_profiles`/);
  assert.ok(!workflow.nodes.some((node) => /gmail|email|wordpress|httpRequest/i.test(node.type)));
});
