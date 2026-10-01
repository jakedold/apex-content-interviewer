import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const workflow = JSON.parse(fs.readFileSync(new URL('../n8n/25-sync-doctor-census.json', import.meta.url), 'utf8'));

test('census sync is hourly, privacy-limited, and credential-free in source control', () => {
  assert.equal(workflow.active, false);
  assert.ok(workflow.nodes.some((node) => node.type === 'n8n-nodes-base.scheduleTrigger'));
  const readers = workflow.nodes.filter((node) => node.type === 'n8n-nodes-base.googleSheets');
  assert.equal(readers.length, 5);
  assert.ok(readers.every((node) => !node.credentials));
  assert.deepEqual(
    readers.map((node) => node.parameters.options.dataLocationOnSheet.values.range).sort(),
    ['A1:C250', 'A1:D100', 'A1:N250', 'A2:D250', 'I2:I250'].sort(),
  );
});

test('census sync preserves history and never enables publishing', () => {
  const sync = workflow.nodes.find((node) => node.name === 'Sync Census to BigQuery');
  assert.ok(sync);
  assert.equal(sync.parameters.authentication, 'oAuth2');
  assert.match(sync.parameters.sqlQuery, /STARTS_WITH\(T\.doctor_id, 'doctor_census_'\)/);
  assert.match(sync.parameters.sqlQuery, /SET active = FALSE/);
  assert.match(sync.parameters.sqlQuery, /'UNVERIFIED' AS mapping_status/);
  assert.doesNotMatch(sync.parameters.sqlQuery, /DELETE FROM/);
  assert.doesNotMatch(sync.parameters.sqlQuery, /publisher_type = 'WORDPRESS'/);
});
