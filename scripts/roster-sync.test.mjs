import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const workflow = JSON.parse(fs.readFileSync(new URL('../n8n/25-sync-doctor-census.json', import.meta.url), 'utf8'));

test('census sync is hourly, privacy-limited, and credential-free in source control', () => {
  assert.equal(workflow.active, false);
  assert.ok(workflow.nodes.some((node) => node.type === 'n8n-nodes-base.scheduleTrigger'));
  const readers = workflow.nodes.filter((node) => node.type === 'n8n-nodes-base.googleSheets');
  assert.equal(readers.length, 6);
  assert.ok(readers.every((node) => !node.credentials));
  assert.deepEqual(
    readers.map((node) => node.parameters.options.dataLocationOnSheet.values.range).sort(),
    ['A1:C250', 'A1:D100', 'A1:K500', 'A1:N250', 'A2:D250', 'I2:I250'].sort(),
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

test('a bad Doctor Profiles row is skipped and reported instead of stopping the whole sync', () => {
  const prepare = workflow.nodes.find((node) => node.name === 'Prepare Current Census Roster').parameters.jsCode;
  const sheets = {
    'Keep location rows together': [{ Code: 'CO-04', Name: 'Audubon Dental', Type: 'GD', URL: 'audubondentalcare.com' }],
    'Keep website rows together': [{ Codes: 'CO-04', Locations: 'Audubon Dental', 'Wordpress Site': 'apexparent.hostmanpowered.com/co-04/' }],
    'Keep dentist rows together': [{ row_number: 2, Employee: 'Test Doctor', 'Primary Location': 'Audubon Dental (CO-04)', Department: 'General Dentist', 'Employment Type': 'Full-Time' }],
    'Keep email rows together': [{ row_number: 2, 'Work Email': 'test.doctor@example.com' }],
    'Keep doctor profiles together': [
      { row_number: 2, Active: true, 'Work Email': 'test.doctor@example.com', 'Location Code': 'CO-04', 'Doctor Name': 'Dr. Test Doctor', Credentials: 'DDS', 'Short Bio': 'Dr. Test Doctor is a placeholder used only in this test.', 'Photo Source URL': 'https://www.ebay.com/itm/324508445477' },
      { row_number: 3, Active: true, 'Work Email': 'test.doctor@example.com', 'Location Code': 'CO-04', 'Doctor Name': 'Dr. Duplicate', Credentials: 'DDS', 'Short Bio': 'A second active row for the same doctor and location.' },
      { row_number: 4, Active: true, 'Work Email': 'other@example.com', 'Location Code': 'CO-04', 'Doctor Name': 'Dr. Missing Bio', Credentials: 'DDS', 'Short Bio': '' },
      { row_number: 5, Active: false, 'Work Email': '', 'Doctor Name': '' },
    ],
  };
  const $ = (name) => ({ first: () => ({ json: { rows: sheets[name] } }) });
  const output = new Function('$', prepare)($)[0].json;
  assert.equal(output.warning_count, 3);
  assert.match(output.warnings.join('\n'), /row 3 \(Dr\. Duplicate\) was skipped: another active row already uses test\.doctor@example\.com at CO-04/);
  assert.match(output.warnings.join('\n'), /row 4 \(Dr\. Missing Bio\) was skipped: missing Short Bio/);
  assert.match(output.warnings.join('\n'), /row 2 \(Dr\. Test Doctor\): the Photo Source URL is not a direct link to an image file/);
  const roster = JSON.parse(output.roster_json);
  assert.equal(roster.doctors[0].author_name, 'Dr. Test Doctor', 'the first valid row is still applied');
  assert.equal(roster.doctors[0].photo_source_url, '', 'a non-image photo link is not used');
  assert.deepEqual(roster.warnings, output.warnings);
  const sql = workflow.nodes.find((node) => node.name === 'Sync Census to BigQuery').parameters.sqlQuery;
  assert.match(sql, /JSON_QUERY\(roster, '\$\.warnings'\) AS warnings/);
});
