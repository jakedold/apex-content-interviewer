// Rebuild the importable, read-only n8n preview from the shared roster validator.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const workflowPath = `${root}n8n/01-roster-selection-preview.json`;
const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
workflow.name = 'AAC - Unified Roster Selection Preview (Inactive)';
const workbookId = '1M0arM4jnZzalySGUKq60Hp1yhTDz2RQTXqMeOWfaOUA';
const node = (name) => workflow.nodes.find((item) => item.name === name);
const sheet = (name, tab, range) => {
  const item = node(name);
  item.parameters.documentId.value = workbookId;
  item.parameters.sheetName.value = tab;
  item.parameters.options.dataLocationOnSheet.values.range = range;
};

sheet('Read location codes and names', 'Locations', 'A1:N250');
sheet('Read public website URLs', 'Wordpress Sites', 'A1:C250');
sheet('Read general dentist census', 'Doctor Census', 'A2:D250');
// The original export used this node to read work email. Retain it as the test reader.
const originalTestReader = workflow.nodes.find((item) => item.parameters?.sheetName?.value === 'Test User') ?? node('Read dentist work emails');
originalTestReader.name = 'Read test users';
originalTestReader.id = 'read-test-users';
sheet('Read test users', 'Test User', 'A1:D100');
// Repair any partial regeneration and keep this builder safe to rerun.
workflow.nodes = workflow.nodes.filter((item) => item === originalTestReader || item.name !== 'Read test users');
if (!node('Read dentist work emails')) {
  const emailReader = structuredClone(node('Read general dentist census'));
  emailReader.id = 'read-dentist-work-emails';
  emailReader.name = 'Read dentist work emails';
  emailReader.position = [1820, 0];
  emailReader.parameters.options.dataLocationOnSheet.values.range = 'I2:I250';
  workflow.nodes.push(emailReader);
}
sheet('Read dentist work emails', 'Doctor Census', 'I2:I250');
if (!node('Keep email rows together')) {
  workflow.nodes.push({
    id: 'keep-email-rows-together', name: 'Keep email rows together', type: 'n8n-nodes-base.code',
    typeVersion: 2, position: [2080, 0], parameters: {
      mode: 'runOnceForAllItems', jsCode: 'return [{ json: { rows: $input.all().map((item) => item.json) } }];',
    },
  });
}
workflow.connections['Keep dentist rows together'].main[0][0].node = 'Read dentist work emails';
workflow.connections['Read dentist work emails'] = { main: [[{ node: 'Keep email rows together', type: 'main', index: 0 }]] };
workflow.connections['Keep email rows together'] = { main: [[{ node: 'Read test users', type: 'main', index: 0 }]] };
workflow.connections['Read test users'] = { main: [[{ node: 'Validate current roster', type: 'main', index: 0 }]] };

const trigger = node('Start selection preview');
trigger.parameters.formDescription = 'Preview a test-only or general-dentist selection from the shared roster workbook. No emails or publishing.';
const audienceField = {
  fieldName: 'audience', fieldLabel: 'Audience', fieldType: 'dropdown', requiredField: true,
  fieldOptions: { values: [{ option: 'Test users only' }, { option: 'General dentists (preview only)' }] },
  defaultValue: 'Test users only',
};
if (!trigger.parameters.formFields.values.some((field) => field.fieldName === 'audience')) trigger.parameters.formFields.values.unshift(audienceField);

const rosterSource = fs.readFileSync(`${root}scripts/campaign-roster.mjs`, 'utf8').replace('export function buildCampaignRoster', 'function buildCampaignRoster');
node('Validate current roster').parameters.jsCode = `${rosterSource}
const rows = (nodeName, columns) => {
  const observed = $(nodeName).first().json.rows;
  if (!Array.isArray(observed)) throw new Error('Sheet read unavailable: ' + nodeName);
  return observed.map((row) => columns.map((column) => row[column] ?? ''));
};
const censusRows = $('Keep dentist rows together').first().json.rows;
const emailByRow = new Map($('Keep email rows together').first().json.rows.map((row) => [Number(row.row_number), row['Work Email'] ?? '']));
const dentists = censusRows.map((row) => {
  const rowNumber = Number(row.row_number);
  if (!Number.isInteger(rowNumber)) throw new Error('Doctor census row number missing.');
  return [row.Employee ?? '', row['Primary Location'] ?? '', row.Department ?? '', row['Employment Type'] ?? '', emailByRow.get(rowNumber) ?? ''];
});
const roster = buildCampaignRoster(
  rows('Keep location rows together', ['Code', 'Name', 'Type', 'URL']),
  rows('Keep website rows together', ['Codes', 'Locations', 'Wordpress Site']),
  dentists,
  $('Read test users').all().map((item) => ['Email', 'Name', 'Location', 'Wordpress URL'].map((column) => item.json[column] ?? ''))
);
const start = $('Start selection preview').first().json;
const audience = start.audience ?? start.Audience;
if (!['Test users only', 'General dentists (preview only)'].includes(audience)) throw new Error('Choose a valid audience.');
const testOnly = audience === 'Test users only';
if (testOnly && !roster.testUsers.length) throw new Error('The Test User tab has no complete entries.');
if (!testOnly && (!roster.locations.length || !roster.doctors.length)) throw new Error('No eligible general-dentist locations or doctors.');
const locationByName = new Map();
const testLocations = [];
for (const user of roster.testUsers) {
  const key = user.location_name + '|' + user.wordpress_site_url;
  if (!locationByName.has(user.location_name)) {
    const location = { code: 'TEST-' + (testLocations.length + 1), name: user.location_name, wordpress_site_url: user.wordpress_site_url };
    locationByName.set(user.location_name, location);
    testLocations.push(location);
  } else if (locationByName.get(user.location_name).wordpress_site_url !== user.wordpress_site_url) {
    throw new Error('Conflicting WordPress URLs for test location: ' + user.location_name);
  }
}
return [{ json: { audience, test_only: testOnly, locations: testOnly ? testLocations : roster.locations,
  doctors: testOnly ? roster.testUsers.map((user) => ({ name: user.name, email: user.email, location_code: locationByName.get(user.location_name).code })) : roster.doctors,
  excluded_location_count: roster.excludedLocations.length, excluded_doctor_count: roster.excludedDoctors.length } }];`;

node('Choose locations').parameters.options.formTitle = 'Choose locations (preview only)';
node('Filter doctors by selected locations').parameters.jsCode = node('Filter doctors by selected locations').parameters.jsCode.replace(
  'const raw = $input.first().json.selected_locations;',
  "const input = $input.first().json;\nconst raw = input.selected_locations ?? input['Locations (all initially selected; uncheck to exclude)'];",
);
node('Choose doctors').parameters.options.formTitle = 'Choose recipients (preview only)';
node('Preview selection without sending').parameters.jsCode = `const available = $('Filter doctors by selected locations').first().json;
const input = $input.first().json;
const raw = input.selected_doctors ?? input['Doctors (all initially selected; uncheck to exclude)'];
const selections = Array.isArray(raw) ? raw : raw ? [raw] : [];
const byLabel = new Map(available.doctors.map((x) => [x.name + ' (' + x.location_code + ') — ' + x.email, x]));
const doctors = selections.map((label) => {
  const doctor = byLabel.get(label);
  if (!doctor) throw new Error('Unknown recipient selection: ' + label);
  return doctor;
});
if (!doctors.length || new Set(doctors.map((x) => x.email)).size !== doctors.length) throw new Error('Select at least one distinct recipient.');
const details = $('Start selection preview').first().json;
const roster = $('Validate current roster').first().json;
return [{ json: { preview_only: true, test_only: roster.test_only, audience: roster.audience,
  campaign_name: details.campaign_name ?? details['Campaign name'], campaign_month: details.campaign_month ?? details['Campaign month'],
  topics: [details.topic_1 ?? details['Topic 1'], details.topic_2 ?? details['Topic 2'], details.topic_3 ?? details['Topic 3']], location_count: available.locations.length,
  recipient_count: doctors.length, locations: available.locations, recipients: doctors,
  message: 'Preview only: no campaign, invitations, WordPress posts, or static-site release created.' } }];`;
node('Selection Preview Notes').parameters.content = '## Read-only campaign selection\n\nAll five readers use the Authoritative Blog Article Distribution workbook: Locations, Wordpress Sites, Doctor Census A-D and I, and Test User. Attach the existing Google Sheets credential to the readers and dedicated Basic Auth to the trigger after import. Keep inactive. Test users and general dentists are separate audiences. This workflow has no campaign write, email, WordPress publish, or static-site release action.';
workflow.active = false;
fs.writeFileSync(workflowPath, `${JSON.stringify(workflow, null, 2)}\n`);
