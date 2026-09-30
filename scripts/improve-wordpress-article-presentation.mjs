import { readFileSync, writeFileSync } from 'node:fs';

const load = (path) => JSON.parse(readFileSync(path, 'utf8'));
const save = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
const node = (workflow, name) => {
  const found = workflow.nodes.find((entry) => entry.name === name);
  if (!found) throw new Error(`${workflow.name}: missing ${name}`);
  return found;
};

const validation = `
const bylines = html.match(/<p\\b[^>]*class=["'][^"']*\\barticle-byline\\b[^"']*["'][^>]*>/gi) || [];
if (bylines.length !== 1) throw new Error('Production HTML must contain exactly one interviewed-doctor byline.');
const profiles = html.match(/<(?:section|div)\\b[^>]*class=["'][^"']*\\barticle-doctor-profile\\b[^"']*["'][^>]*>/gi) || [];
if (profiles.length !== 1) throw new Error('Production HTML must contain exactly one doctor profile section.');
const faqHeading = /<h2\\b[^>]*>[^<]*(?:frequently asked questions|faq)[^<]*<\\/h2>/i.exec(html);
if (!faqHeading) throw new Error('Production HTML must contain a clearly labeled FAQ section.');
const faqHtml = html.slice(faqHeading.index);
const faqItems = faqHtml.match(/<h3\\b[^>]*>/gi) || [];
if (faqItems.length < 3 || faqItems.length > 6) throw new Error('Production HTML FAQ must contain 3 to 6 questions.');
if (/<h2\\b/i.test(faqHtml.slice(faqHeading[0].length))) throw new Error('The FAQ must be the final public section.');
`;

for (const [path, validatorName, marker] of [
  ['n8n/06-generate-article.json', 'Validate and Parse Article Package', "if (review.length < 1000) {"],
  ['n8n/10-revise-article-from-doctor-feedback.json', 'Validate Revised Package', "if (review.length < 1000) {"],
  ['n8n/20-revise-article-from-marketing-feedback.json', 'Validate Marketing Revision', "if (review.length < 1000) {"],
]) {
  const workflow = load(path);
  const target = node(workflow, validatorName);
  if (!target.parameters.jsCode.includes('Production HTML must contain exactly one interviewed-doctor byline.')) {
    target.parameters.jsCode = target.parameters.jsCode.replace(marker, `${validation}\n${marker}`);
  }
  save(path, workflow);
}

const publisherPath = 'n8n/15-publish-approved-article-to-wordpress.json';
const publisher = load(publisherPath);
const loader = node(publisher, 'Load Approved WordPress Article');
if (!loader.parameters.sqlQuery.includes('doctor_profiles')) {
  loader.parameters.sqlQuery = loader.parameters.sqlQuery.replace(
    'SELECT a.article_id,',
    `CREATE TABLE IF NOT EXISTS \`apex-marketing-n8n.automated_article_creation.doctor_profiles\` (
  doctor_id STRING NOT NULL, practice_id STRING NOT NULL, work_email STRING,
  doctor_name STRING, credentials STRING, location_code STRING, profile_url STRING, photo_url STRING, short_bio STRING,
  source STRING, verified_at TIMESTAMP, active BOOL
);
CREATE TABLE IF NOT EXISTS \`apex-marketing-n8n.automated_article_creation.article_assets\` (
  article_id STRING NOT NULL, version_number INT64 NOT NULL, asset_type STRING NOT NULL,
  concept STRING, source_type STRING, source_reference STRING, rights_basis STRING,
  alt_text STRING, wordpress_media_id INT64, wordpress_media_url STRING,
  status STRING NOT NULL, created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL
);
SELECT a.article_id,`,
  );
  loader.parameters.sqlQuery = loader.parameters.sqlQuery.replace(
    'p.practice_name, p.website_domain, p.publisher_type, p.publisher_config_reference,\n  v.content AS publication_package_json',
    `p.practice_name, p.website_domain, p.publisher_type, p.publisher_config_reference,
  dp.profile_url AS doctor_profile_url, dp.photo_url AS doctor_photo_url,
  dp.short_bio AS doctor_short_bio, dp.source AS doctor_profile_source,
  dp.verified_at AS doctor_profile_verified_at,
  fa.concept AS featured_image_concept, fa.source_type AS featured_image_source_type,
  fa.source_reference AS featured_image_source_reference, fa.rights_basis AS featured_image_rights_basis,
  fa.alt_text AS featured_image_alt_text, fa.wordpress_media_id AS featured_image_media_id,
  fa.wordpress_media_url AS featured_image_media_url,
  v.content AS publication_package_json`,
  );
  loader.parameters.sqlQuery = loader.parameters.sqlQuery.replace(
    "LEFT JOIN `apex-marketing-n8n.automated_article_creation.publication_records` pr",
    `LEFT JOIN \`apex-marketing-n8n.automated_article_creation.doctor_profiles\` dp
  ON dp.doctor_id = a.doctor_id AND dp.practice_id = a.practice_id AND dp.active = TRUE
LEFT JOIN \`apex-marketing-n8n.automated_article_creation.article_assets\` fa
  ON fa.article_id = a.article_id AND fa.version_number = a.current_version
  AND fa.asset_type = 'FEATURED_IMAGE' AND fa.status = 'READY'
LEFT JOIN \`apex-marketing-n8n.automated_article_creation.publication_records\` pr`,
  );
}
loader.parameters.sqlQuery = loader.parameters.sqlQuery
  .replace(
    'doctor_id STRING NOT NULL, profile_url STRING, photo_url STRING, short_bio STRING,',
    'doctor_id STRING NOT NULL, practice_id STRING NOT NULL, work_email STRING,\n  doctor_name STRING, location_code STRING, profile_url STRING, photo_url STRING, short_bio STRING,',
  )
  .replace(
    'ON dp.doctor_id = a.doctor_id AND dp.active = TRUE',
    'ON dp.doctor_id = a.doctor_id AND dp.practice_id = a.practice_id AND dp.active = TRUE',
  );

const prepare = node(publisher, 'Prepare WordPress Publication');
prepare.parameters.jsCode = prepare.parameters.jsCode.replace(
  /^\s*const match = .*\.exec\(candidate\);$/m,
  () => "  const match = /^https:\\/\\/([A-Za-z0-9.-]+)(\\/[\\/A-Za-z0-9._~%!$&'()*+,;=:@-]*)?\\/?$/.exec(candidate);",
);
if (!prepare.parameters.jsCode.includes('article-byline')) {
  prepare.parameters.jsCode = prepare.parameters.jsCode.replace(
    "const title = String(metadata.h1 || '').trim()",
    `const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));
const doctorName = String(row.doctor_name || '').trim();
const credentials = String(row.credentials || '').trim();
if (!doctorName) throw new Error('The interviewed doctor name is required for attribution.');
const doctorLabel = credentials ? doctorName + ', ' + credentials : doctorName;
html = html.replace(/<p\\b[^>]*class=["'][^"']*\\barticle-byline\\b[^"']*["'][^>]*>[\\s\\S]*?<\\/p>\\s*/gi, '');
html = '<p class="article-byline">By <strong>' + escapeHtml(doctorLabel) + '</strong></p>\\n' + html;
const faqHeading = /<h2\\b[^>]*>[^<]*(?:frequently asked questions|faq)[^<]*<\\/h2>/i.exec(html);
if (!faqHeading) throw new Error('The approved article must include a clearly labeled FAQ.');
const faqHtml = html.slice(faqHeading.index);
const faqItems = faqHtml.match(/<h3\\b[^>]*>/gi) || [];
if (faqItems.length < 3 || faqItems.length > 6 || /<h2\\b/i.test(faqHtml.slice(faqHeading[0].length))) {
  throw new Error('The approved article FAQ must contain 3 to 6 questions and be the final public section.');
}
html = html.replace(/<(section|div)\\b[^>]*class=["'][^"']*\\barticle-doctor-profile\\b[^"']*["'][^>]*>[\\s\\S]*?<\\/\\1>\\s*/gi, '');
const bio = String(row.doctor_short_bio || '').trim();
const profileUrl = String(row.doctor_profile_url || '').trim();
const photoUrl = String(row.doctor_photo_url || '').trim();
let profile = '<section class="article-doctor-profile"><h2>About ' + escapeHtml(doctorName) + '</h2>';
if (photoUrl) {
  const safePhotoUrl = requireHttpsUrl(photoUrl, 'Doctor profile photo');
  profile += '<figure><img src="' + escapeHtml(safePhotoUrl) + '" alt="' + escapeHtml(doctorName) + '" loading="lazy"></figure>';
}
profile += '<p>' + escapeHtml(bio || (doctorName + ' is the dentist interviewed for this article.')) + '</p>';
if (profileUrl) {
  const safeProfileUrl = requireHttpsUrl(profileUrl, 'Doctor public profile');
  profile += '<p><a href="' + escapeHtml(safeProfileUrl) + '">Read more about ' + escapeHtml(doctorName) + '</a></p>';
}
profile += '</section>';
html = html.slice(0, faqHeading.index) + profile + '\\n' + html.slice(faqHeading.index);

const title = String(metadata.h1 || '').trim()`,
  );
  prepare.parameters.jsCode = prepare.parameters.jsCode.replace(
    "title, content: html, slug, excerpt, status: 'publish',",
    "title, content: html, slug, excerpt, status: 'publish',\n    ...(Number(row.featured_image_media_id) > 0 ? { featured_media: Number(row.featured_image_media_id) } : {}),",
  );
}
if (!prepare.parameters.jsCode.includes('article-featured-image') && !prepare.parameters.jsCode.includes('const featuredImageSourceUrl =')) {
  prepare.parameters.jsCode = prepare.parameters.jsCode.replace(
    "const faqHeading = /<h2\\b[^>]*>[^<]*(?:frequently asked questions|faq)[^<]*<\\/h2>/i.exec(html);",
    `const featuredImageUrl = String(row.featured_image_media_url || '').trim();
if (featuredImageUrl && !/class=["'][^"']*\\barticle-featured-image\\b/i.test(html)) {
  const safeFeaturedImageUrl = requireHttpsUrl(featuredImageUrl, 'Featured image');
  if (!safeFeaturedImageUrl.startsWith(publicationBaseUrl + '/wp-content/uploads/')) throw new Error('The selected topic image must belong to the target WordPress subsite Media Library.');
  const featuredImageAlt = String(row.featured_image_alt_text || '').trim();
  if (!featuredImageAlt) throw new Error('A READY featured image must include useful alt text.');
  const figure = '<figure class="article-featured-image"><img src="' + escapeHtml(safeFeaturedImageUrl) + '" alt="' + escapeHtml(featuredImageAlt) + '"></figure>';
  html = html.replace(/(<p\\b[^>]*class=["'][^"']*\\barticle-byline\\b[^"']*["'][^>]*>[\\s\\S]*?<\\/p>)/i, '$1\\n' + figure);
}
const faqHeading = /<h2\\b[^>]*>[^<]*(?:frequently asked questions|faq)[^<]*<\\/h2>/i.exec(html);`,
  );
}
if (!prepare.parameters.jsCode.includes('must belong to the target WordPress subsite')) {
  prepare.parameters.jsCode = prepare.parameters.jsCode.replace(
    "  const safeFeaturedImageUrl = requireHttpsUrl(featuredImageUrl, 'Featured image');",
    "  const safeFeaturedImageUrl = requireHttpsUrl(featuredImageUrl, 'Featured image');\n  if (!safeFeaturedImageUrl.startsWith(publicationBaseUrl + '/wp-content/uploads/')) throw new Error('The selected topic image must belong to the target WordPress subsite Media Library.');",
  );
}
save(publisherPath, publisher);

// Keep the older presentation migration usable without restoring the obsolete
// requirement that every campaign image already exist in every target subsite.
await import('./configure-central-topic-image-upload.mjs');
