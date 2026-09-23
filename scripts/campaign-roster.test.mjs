import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildCampaignRoster } from './campaign-roster.mjs';

test('joins by location code, normalizes WordPress URLs, and excludes ineligible dentists', () => {
  const roster = buildCampaignRoster(
    [['TX-01', 'Main Dental', 'GD', 'maindental.com'], ['TX-02-E', 'Endo', 'Endo', 'endo.com'], ['DFW-24', 'New Dental', 'GD', 'new.example.org'], ['DFW-T', 'DFW-Test', 'GD', 'test.com']],
    [['TX-01', 'Main Dental', 'editing.example.org/tx-01'], ['TX-02-E', 'Endo', 'editing.example.org/endo'], ['DFW-24', 'New Dental', 'editing.example.org/new'], ['DFW-T', 'DFW-Test', 'editing.example.org/test']],
    [['A Dentist', 'Main Dental (TX-01)', 'General Dentist', 'Full-Time', 'a@example.com'], ['B Dentist', 'Main Dental (TX-01)', 'General Dentist', 'Part-Time', 'b@example.com'], ['C Dentist', 'Main Dental (TX-01)', 'General Dentist', 'Contractor', 'c@example.com'], ['D Dentist', 'New Dental (DFW-24)', 'General Dentist', 'Full-Time', 'd@example.com'], ['E Dentist', 'DFW-Test (DFW-T)', 'General Dentist', 'Full-Time', 'e@example.com']],
    [['test@example.com', 'Test Person', 'Test Site', 'https://editing.example.org/test-site/']],
  );
  assert.deepEqual(roster.locations, [{ code: 'TX-01', name: 'Main Dental', public_website_url: 'https://maindental.com/', wordpress_site_url: 'https://editing.example.org/tx-01/' }]);
  assert.deepEqual(roster.doctors.map(({ name }) => name), ['A Dentist', 'B Dentist']);
  assert.deepEqual(roster.testUsers, [{ name: 'Test Person', email: 'test@example.com', location_name: 'Test Site', wordpress_site_url: 'https://editing.example.org/test-site/' }]);
  assert.deepEqual(roster.excludedDoctors.map(({ reason }) => reason), ['not_employee', 'location_unavailable', 'test_location']);
  assert.deepEqual(roster.excludedLocations.map(({ reason }) => reason), ['specialty_or_nonpractice', 'not_launched', 'test_location']);
});

test('missing or mismatched WordPress mapping blocks a production location', () => {
  const roster = buildCampaignRoster(
    [['TX-01', 'Main Dental', 'GD', 'main.example.org'], ['TX-02', 'Other Dental', 'GD', 'other.example.org']],
    [['TX-01', 'Wrong Name', 'editing.example.org/tx-01']],
    [],
  );
  assert.equal(roster.locations.length, 0);
  assert.deepEqual(roster.excludedLocations.map(({ reason }) => reason), ['wordpress_name_mismatch', 'missing_or_invalid_wordpress_site']);
});

test('rejects duplicate WordPress codes and incomplete test users', () => {
  assert.throws(() => buildCampaignRoster([], [['TX-01', 'One', 'example.org/one'], ['TX-01', 'One', 'example.org/two']], []), /Duplicate WordPress/);
  assert.throws(() => buildCampaignRoster([], [], [], [['test@example.com', 'Test', 'Place', '']]), /Incomplete test user/);
});
