import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const sqlPath = path.join(root, 'sql', 'initial-practice-site-mapping-2026-09-23.sql');
const source = fs.readFileSync(sqlPath, 'utf8');
const rowPattern = /STRUCT\('([^']+)' AS location_code, '((?:[^']|'')+)' AS practice_name, '([^']+)' AS public_website_url, '([^']+)' AS wordpress_base_url\)/g;
const rows = [...source.matchAll(rowPattern)].map((match) => ({
  locationCode: match[1],
  practiceName: match[2].replaceAll("''", "'"),
  publicWebsiteUrl: match[3],
  wordpressBaseUrl: match[4].replace(/\/$/, ''),
}));

if (!rows.length) throw new Error(`No practice mappings were found in ${sqlPath}.`);

const bySite = new Map();
for (const row of rows) {
  const group = bySite.get(row.wordpressBaseUrl) ?? [];
  group.push(row);
  bySite.set(row.wordpressBaseUrl, group);
}

const sites = [...bySite.entries()].map(([wordpressBaseUrl, practices]) => ({ wordpressBaseUrl, practices }));
const results = [];
let cursor = 0;

const auditSite = async ({ wordpressBaseUrl, practices }) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${wordpressBaseUrl}/wp-json/`, {
      headers: { Accept: 'application/json', 'User-Agent': 'AAC-Practice-Site-Audit/1.0' },
      redirect: 'follow',
      signal: controller.signal,
    });
    const data = response.ok ? await response.json() : null;
    const namespaces = Array.isArray(data?.namespaces) ? data.namespaces : [];
    const restReady = response.ok && namespaces.includes('wp/v2');
    const reportedUrl = String(data?.url ?? data?.home ?? '').replace(/\/$/, '');
    const expectedPath = new URL(wordpressBaseUrl).pathname.replace(/\/$/, '');
    const reportedPath = reportedUrl ? new URL(reportedUrl).pathname.replace(/\/$/, '') : '';
    return {
      wordpressBaseUrl,
      locationCodes: practices.map((practice) => practice.locationCode),
      practiceNames: practices.map((practice) => practice.practiceName),
      sharedSite: practices.length > 1,
      httpStatus: response.status,
      restReady,
      reportedSiteName: String(data?.name ?? ''),
      reportedUrl,
      pathMatches: reportedPath === expectedPath,
      status: restReady && reportedPath === expectedPath ? 'PASS' : 'REVIEW',
    };
  } catch (error) {
    return {
      wordpressBaseUrl,
      locationCodes: practices.map((practice) => practice.locationCode),
      practiceNames: practices.map((practice) => practice.practiceName),
      sharedSite: practices.length > 1,
      restReady: false,
      status: 'ERROR',
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
};

const worker = async () => {
  while (cursor < sites.length) {
    const site = sites[cursor++];
    results.push(await auditSite(site));
  }
};

await Promise.all(Array.from({ length: Math.min(8, sites.length) }, () => worker()));
results.sort((a, b) => a.wordpressBaseUrl.localeCompare(b.wordpressBaseUrl));

const summary = {
  auditedAt: new Date().toISOString(),
  practiceLocations: rows.length,
  distinctWordpressSites: sites.length,
  passed: results.filter((result) => result.status === 'PASS').length,
  review: results.filter((result) => result.status === 'REVIEW').length,
  errors: results.filter((result) => result.status === 'ERROR').length,
  sharedSites: results.filter((result) => result.sharedSite).length,
};

console.log(JSON.stringify({ summary, results }, null, 2));
if (summary.review || summary.errors) process.exitCode = 1;
