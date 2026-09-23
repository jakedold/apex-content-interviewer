// Pure roster validation for the administrator campaign form. No roster data or credentials live here.
const text = (value) => String(value ?? '').trim();
const doctorCode = (primaryLocation) => text(primaryLocation).match(/\(([^)]+)\)\s*$/)?.[1] ?? '';

export function buildCampaignRoster(locationRows, websiteRows, dentistRows, emailRows) {
  const locations = [];
  const excludedLocations = [];
  const locationByCode = new Map();
  for (let index = 0; index < locationRows.length; index += 1) {
    const [rawCode, rawName, rawType] = locationRows[index] ?? [];
    const code = text(rawCode);
    if (!code) continue;
    const name = text(rawName);
    const type = text(rawType);
    const website = text(websiteRows[index]?.[0]);
    const reason = /-(E|O|P)$/i.test(code) || type !== 'GD' ? 'specialty_or_nonpractice'
      : /test/i.test(`${code} ${name}`) ? 'test_location'
        : !website ? 'missing_website'
          : !/^[a-z0-9.-]+\.[a-z]{2,}(?:\/[^?#]*)?$/i.test(website) ? 'invalid_website'
            : null;
    if (reason) {
      excludedLocations.push({ code, name, reason });
      continue;
    }
    if (locationByCode.has(code)) throw new Error(`Duplicate location code: ${code}`);
    const location = { code, name, website_url: `https://${website.replace(/\/$/, '').toLowerCase()}` };
    locationByCode.set(code, location);
    locations.push(location);
  }

  const doctors = [];
  const excludedDoctors = [];
  const seenEmails = new Set();
  for (let index = 0; index < dentistRows.length; index += 1) {
    const [rawName, rawPrimary, rawDepartment, rawEmployment] = dentistRows[index] ?? [];
    const name = text(rawName);
    if (!name) continue;
    const primary = text(rawPrimary);
    const code = doctorCode(primary);
    const department = text(rawDepartment);
    const employment = text(rawEmployment);
    const email = text(emailRows[index]?.[0]).toLowerCase();
    const reason = department !== 'General Dentist' ? 'not_general_dentist'
      : !['Full-Time', 'Part-Time'].includes(employment) ? 'not_employee'
        : /test/i.test(primary) || code === 'DFW-T' ? 'test_location'
          : !locationByCode.has(code) ? 'location_unavailable'
            : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'missing_or_invalid_work_email'
              : null;
    if (reason) {
      excludedDoctors.push({ name, code, reason });
      continue;
    }
    if (seenEmails.has(email)) throw new Error(`Duplicate work email in census: ${email}`);
    seenEmails.add(email);
    doctors.push({ name, email, location_code: code });
  }
  return { locations, doctors, excludedLocations, excludedDoctors };
}
