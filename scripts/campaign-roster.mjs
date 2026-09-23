// Pure roster validation. Do not persist a snapshot of people or credentials.
const text = (value) => String(value ?? '').trim();
const codeFromPrimaryLocation = (value) => text(value).match(/\(([^)]+)\)\s*$/)?.[1] ?? '';
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

function siteUrl(value) {
  const raw = text(value);
  if (!raw) return '';
  // n8n Code nodes don't consistently expose the URL constructor.
  const match = raw.match(/^(?:https:\/\/)?([a-z0-9.-]+)(\/[^?#\\\s]*)?$/i);
  if (!match) return '';
  const host = match[1].toLowerCase();
  const labels = host.split('.');
  if (labels.length < 2 || labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label))) return '';
  const path = match[2] || '/';
  return `https://${host}${path.replace(/\/*$/, '/')}`;
}

export function buildCampaignRoster(locationRows, wordpressRows, dentistRows, testRows = []) {
  const heldLocations = new Set(['DFW-24', 'DFW-25']);
  const wordpressByCode = new Map();
  for (const [rawCode, rawName, rawUrl] of wordpressRows) {
    const code = text(rawCode);
    if (!code) continue;
    if (wordpressByCode.has(code)) throw new Error(`Duplicate WordPress location code: ${code}`);
    wordpressByCode.set(code, { name: text(rawName), url: siteUrl(rawUrl) });
  }

  const locations = [];
  const excludedLocations = [];
  const locationByCode = new Map();
  for (const [rawCode, rawName, rawType, rawPublicUrl] of locationRows) {
    const code = text(rawCode);
    if (!code) continue;
    if (locationByCode.has(code)) throw new Error(`Duplicate location code: ${code}`);
    const name = text(rawName);
    const wordpress = wordpressByCode.get(code);
    const publicUrl = siteUrl(rawPublicUrl);
    const reason = heldLocations.has(code) ? 'not_launched'
      : /-(E|O|P)$/i.test(code) || text(rawType) !== 'GD' ? 'specialty_or_nonpractice'
        : /test/i.test(`${code} ${name}`) ? 'test_location'
          : !publicUrl ? 'missing_or_invalid_public_website'
            : !wordpress?.url ? 'missing_or_invalid_wordpress_site'
              : wordpress.name !== name ? 'wordpress_name_mismatch' : null;
    if (reason) {
      excludedLocations.push({ code, name, reason });
      continue;
    }
    const location = { code, name, public_website_url: publicUrl, wordpress_site_url: wordpress.url };
    locationByCode.set(code, location);
    locations.push(location);
  }

  const doctors = [];
  const excludedDoctors = [];
  const seenEmails = new Set();
  for (const [rawName, rawPrimary, rawDepartment, rawEmployment, rawEmail] of dentistRows) {
    const name = text(rawName);
    if (!name) continue;
    const primary = text(rawPrimary);
    const code = codeFromPrimaryLocation(primary);
    const email = text(rawEmail).toLowerCase();
    const reason = text(rawDepartment) !== 'General Dentist' ? 'not_general_dentist'
      : !['Full-Time', 'Part-Time'].includes(text(rawEmployment)) ? 'not_employee'
        : /test/i.test(primary) || code === 'DFW-T' ? 'test_location'
          : !locationByCode.has(code) ? 'location_unavailable'
            : !validEmail(email) ? 'missing_or_invalid_work_email' : null;
    if (reason) {
      excludedDoctors.push({ name, code, reason });
      continue;
    }
    if (seenEmails.has(email)) throw new Error(`Duplicate work email in census: ${email}`);
    seenEmails.add(email);
    doctors.push({ name, email, location_code: code });
  }

  const testUsers = [];
  const seenTestEmails = new Set();
  for (const [rawEmail, rawName, rawLocation, rawWordpressUrl] of testRows) {
    const email = text(rawEmail).toLowerCase();
    if (!email) continue;
    const name = text(rawName);
    const location = text(rawLocation);
    const wordpressUrl = siteUrl(rawWordpressUrl);
    if (!validEmail(email) || !name || !location || !wordpressUrl) throw new Error(`Incomplete test user row: ${email}`);
    if (seenTestEmails.has(email)) throw new Error(`Duplicate test email: ${email}`);
    seenTestEmails.add(email);
    testUsers.push({ name, email, location_name: location, wordpress_site_url: wordpressUrl });
  }
  return { locations, doctors, testUsers, excludedLocations, excludedDoctors };
}
