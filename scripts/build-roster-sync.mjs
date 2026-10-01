import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const preview = JSON.parse(fs.readFileSync(new URL('n8n/01-roster-selection-preview.json', root), 'utf8'));
const completion = JSON.parse(fs.readFileSync(new URL('n8n/05-interview-completed.json', root), 'utf8'));
const sourceNode = (name) => structuredClone(preview.nodes.find((node) => node.name === name));

const readerNames = [
  'Read location codes and names',
  'Keep location rows together',
  'Read public website URLs',
  'Keep website rows together',
  'Read general dentist census',
  'Keep dentist rows together',
  'Read dentist work emails',
  'Keep email rows together',
  'Read test users',
];
const nodes = readerNames.map(sourceNode);
const rosterSource = fs.readFileSync(new URL('scripts/campaign-roster.mjs', root), 'utf8')
  .replace('export function buildCampaignRoster', 'function buildCampaignRoster');
const validate = sourceNode('Validate current roster');
validate.id = 'prepare-roster-sync';
validate.name = 'Prepare Current Census Roster';
validate.position = [1120, 100];
validate.parameters.jsCode = `${rosterSource}

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
  []
);
if (!roster.locations.length || !roster.doctors.length) throw new Error('The current census produced no eligible practices or doctors.');
const normalized = {
  locations: roster.locations.map((location) => ({
    ...location,
    practice_id: 'practice_' + location.code.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
  })),
  doctors: roster.doctors.map((doctor) => ({
    ...doctor,
    doctor_id: 'doctor_census_' + doctor.email.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
    practice_id: 'practice_' + doctor.location_code.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
  })),
};
return [{ json: {
  roster_json: JSON.stringify(normalized),
  practice_count: normalized.locations.length,
  doctor_count: normalized.doctors.length,
  excluded_location_count: roster.excludedLocations.length,
  excluded_doctor_count: roster.excludedDoctors.length,
} }];`;
nodes.push(validate);

const bigQueryTemplate = completion.nodes.find((node) => node.name === 'Persist Interview and Mark Complete');
const sync = {
  ...structuredClone(bigQueryTemplate),
  id: 'sync-census-to-bigquery',
  name: 'Sync Census to BigQuery',
  position: [1360, 100],
};
// The live n8n instance uses the shared BigQuery OAuth2 credential. Keep the
// exported workflow credential-free, but make its expected credential type
// match the connection that operators can safely attach after import.
sync.parameters.authentication = 'oAuth2';
sync.parameters.sqlQuery = `DECLARE roster JSON DEFAULT PARSE_JSON(@roster_json);

CREATE TEMP TABLE source_practices AS
SELECT
  JSON_VALUE(location, '$.practice_id') AS practice_id,
  JSON_VALUE(location, '$.code') AS location_code,
  JSON_VALUE(location, '$.name') AS practice_name,
  JSON_VALUE(location, '$.public_website_url') AS website_domain,
  JSON_VALUE(location, '$.wordpress_site_url') AS wordpress_base_url
FROM UNNEST(JSON_QUERY_ARRAY(roster, '$.locations')) location;

CREATE TEMP TABLE source_doctors AS
SELECT
  JSON_VALUE(doctor, '$.doctor_id') AS doctor_id,
  JSON_VALUE(doctor, '$.name') AS doctor_name,
  LOWER(JSON_VALUE(doctor, '$.email')) AS email,
  JSON_VALUE(doctor, '$.practice_id') AS practice_id
FROM UNNEST(JSON_QUERY_ARRAY(roster, '$.doctors')) doctor;

ASSERT (SELECT COUNT(*) FROM source_practices) > 0 AS 'The census sync contains no eligible practices.';
ASSERT (SELECT COUNT(*) FROM source_doctors) > 0 AS 'The census sync contains no eligible doctors.';
ASSERT (SELECT COUNT(*) FROM source_practices) = (SELECT COUNT(DISTINCT practice_id) FROM source_practices) AS 'Duplicate practice IDs in the census sync.';
ASSERT (SELECT COUNT(*) FROM source_doctors) = (SELECT COUNT(DISTINCT doctor_id) FROM source_doctors) AS 'Duplicate doctor IDs in the census sync.';
ASSERT NOT EXISTS (SELECT 1 FROM source_doctors WHERE practice_id NOT IN (SELECT practice_id FROM source_practices)) AS 'A census doctor is missing an eligible practice mapping.';

MERGE \`apex-marketing-n8n.automated_article_creation.practices\` T
USING source_practices S
ON T.practice_id = S.practice_id
WHEN MATCHED THEN UPDATE SET
  practice_name = S.practice_name,
  website_domain = S.website_domain,
  publisher_config_reference = TO_JSON_STRING(JSON_SET(
    COALESCE(SAFE.PARSE_JSON(T.publisher_config_reference), JSON '{}'),
    '$.location_code', S.location_code,
    '$.wordpress_base_url', S.wordpress_base_url,
    '$.mapping_status', COALESCE(JSON_VALUE(SAFE.PARSE_JSON(T.publisher_config_reference), '$.mapping_status'), 'UNVERIFIED')
  )),
  updated_at = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN INSERT
  (practice_id, practice_name, website_domain, publisher_type, publisher_config_reference, active, created_at, updated_at)
VALUES
  (S.practice_id, S.practice_name, S.website_domain, NULL,
   TO_JSON_STRING(STRUCT(S.location_code AS location_code, S.wordpress_base_url AS wordpress_base_url, 'UNVERIFIED' AS mapping_status)),
   FALSE, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP());

MERGE \`apex-marketing-n8n.automated_article_creation.doctors\` T
USING source_doctors S
ON T.doctor_id = S.doctor_id
WHEN MATCHED THEN UPDATE SET
  doctor_name = S.doctor_name,
  email = S.email,
  practice_id = S.practice_id,
  active = TRUE,
  updated_at = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN INSERT
  (doctor_id, doctor_name, credentials, email, practice_id, preferred_communication_channel, fallback_communication_channel, active, created_at, updated_at)
VALUES
  (S.doctor_id, S.doctor_name, NULL, S.email, S.practice_id, 'email', 'email', TRUE, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP());

UPDATE \`apex-marketing-n8n.automated_article_creation.doctors\` T
SET active = FALSE, updated_at = CURRENT_TIMESTAMP()
WHERE STARTS_WITH(T.doctor_id, 'doctor_census_')
  AND NOT EXISTS (SELECT 1 FROM source_doctors S WHERE S.doctor_id = T.doctor_id);

INSERT INTO \`apex-marketing-n8n.automated_article_creation.workflow_events\`
(event_id, entity_type, entity_id, event_type, event_timestamp, source_system, workflow_execution_id, payload)
VALUES (GENERATE_UUID(), 'roster', 'doctor_census', 'roster.synced', CURRENT_TIMESTAMP(), 'n8n:google-sheets', NULL,
  TO_JSON(STRUCT((SELECT COUNT(*) FROM source_practices) AS practice_count, (SELECT COUNT(*) FROM source_doctors) AS doctor_count)));

SELECT
  (SELECT COUNT(*) FROM source_practices) AS practice_count,
  (SELECT COUNT(*) FROM source_doctors) AS doctor_count,
  CURRENT_TIMESTAMP() AS synced_at;`;
sync.parameters.options = {
  location: 'US',
  queryParameters: {
    namedParameters: [{ name: 'roster_json', value: '={{ $json.roster_json }}' }],
  },
};
nodes.push(sync);

nodes.push({
  id: 'hourly-census-sync',
  name: 'Every Hour',
  type: 'n8n-nodes-base.scheduleTrigger',
  typeVersion: 1.2,
  position: [-1120, 40],
  parameters: { rule: { interval: [{ field: 'hours', hoursInterval: 1 }] } },
});
nodes.push({
  id: 'manual-census-sync',
  name: 'Run Census Sync Manually',
  type: 'n8n-nodes-base.manualTrigger',
  typeVersion: 1,
  position: [-1120, 160],
  parameters: {},
});
nodes.push({
  id: 'census-sync-notes',
  name: 'Census Sync Notes',
  type: 'n8n-nodes-base.stickyNote',
  typeVersion: 1,
  position: [-1120, -300],
  parameters: {
    content: '## Doctor census sync\n\nReads only the authoritative roster columns needed for campaign selection: doctor name, primary location, department, employment type, work email, public practice URL, and WordPress site mapping. Runs hourly and can be run manually.\n\nRoster changes update BigQuery doctor names, work emails, and primary-practice links. Removed or ineligible census doctors are made inactive but are not deleted, preserving historical campaigns. New practice mappings remain inactive and UNVERIFIED; the sync never enables publishing or changes credentials.',
    height: 330,
    width: 520,
  },
});

const chain = [
  'Read location codes and names',
  'Keep location rows together',
  'Read public website URLs',
  'Keep website rows together',
  'Read general dentist census',
  'Keep dentist rows together',
  'Read dentist work emails',
  'Keep email rows together',
  'Read test users',
  'Prepare Current Census Roster',
  'Sync Census to BigQuery',
];
const connections = {};
for (let index = 0; index < chain.length - 1; index += 1) {
  connections[chain[index]] = { main: [[{ node: chain[index + 1], type: 'main', index: 0 }]] };
}
for (const trigger of ['Every Hour', 'Run Census Sync Manually']) {
  connections[trigger] = { main: [[{ node: chain[0], type: 'main', index: 0 }]] };
}

const workflow = {
  name: 'AAC - 25 - Sync Doctor Census',
  nodes,
  connections,
  active: false,
  settings: { executionOrder: 'v1', timezone: 'America/Chicago' },
  versionId: 'census-sync-2026-10-01',
  meta: { templateCredsSetupCompleted: true },
  tags: [],
};

fs.writeFileSync(new URL('n8n/25-sync-doctor-census.json', root), `${JSON.stringify(workflow, null, 2)}\n`);
