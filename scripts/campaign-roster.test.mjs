import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildCampaignRoster } from './campaign-roster.mjs';

test('keeps general-dentist employees with usable sites and excludes specialties, tests, and contractors', () => {
  const roster = buildCampaignRoster(
    [['TX-01', 'Main Dental', 'GD'], ['TX-02-E', 'Endo', 'Endo'], ['DFW-24', 'No Website', 'GD'], ['DFW-T', 'DFW-Test', 'GD']],
    [['maindental.com'], ['endo.com'], [''], ['test.com']],
    [['A Dentist', 'Main Dental (TX-01)', 'General Dentist', 'Full-Time'], ['B Dentist', 'Main Dental (TX-01)', 'General Dentist', 'Part-Time'], ['C Dentist', 'Main Dental (TX-01)', 'General Dentist', 'Contractor'], ['D Dentist', 'No Website (DFW-24)', 'General Dentist', 'Full-Time'], ['E Dentist', 'DFW-Test (DFW-T)', 'General Dentist', 'Full-Time']],
    [['a@example.com'], ['b@example.com'], ['c@example.com'], ['d@example.com'], ['e@example.com']],
  );
  assert.deepEqual(roster.locations, [{ code: 'TX-01', name: 'Main Dental', website_url: 'https://maindental.com' }]);
  assert.deepEqual(roster.doctors.map(({ name }) => name), ['A Dentist', 'B Dentist']);
  assert.deepEqual(roster.excludedDoctors.map(({ reason }) => reason), ['not_employee', 'location_unavailable', 'test_location']);
  assert.deepEqual(roster.excludedLocations.map(({ reason }) => reason), ['specialty_or_nonpractice', 'missing_website', 'test_location']);
});
