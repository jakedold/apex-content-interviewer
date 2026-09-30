import { readFileSync, writeFileSync } from 'node:fs';

const load = (path) => JSON.parse(readFileSync(path, 'utf8'));
const save = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
const find = (workflow, name) => {
  const result = workflow.nodes.find((entry) => entry.name === name);
  if (!result) throw new Error(`${workflow.name}: missing ${name}`);
  return result;
};

const schemaSql = `ALTER TABLE \`apex-marketing-n8n.automated_article_creation.campaign_topics\`
  ADD COLUMN IF NOT EXISTS featured_image_source_url STRING;
ALTER TABLE \`apex-marketing-n8n.automated_article_creation.campaign_topics\`
  ADD COLUMN IF NOT EXISTS featured_image_alt_text STRING;
ALTER TABLE \`apex-marketing-n8n.automated_article_creation.campaign_topics\`
  ADD COLUMN IF NOT EXISTS featured_image_source_type STRING;
ALTER TABLE \`apex-marketing-n8n.automated_article_creation.campaign_topics\`
  ADD COLUMN IF NOT EXISTS featured_image_rights_reference STRING;`;

const removeImageColumns = (sql) => sql.replace(
  /ALTER TABLE `apex-marketing-n8n\.automated_article_creation\.campaign_topics`\s+ADD COLUMN IF NOT EXISTS featured_image_(?:concept|media_id|media_url|source_url|alt_text|source_type|rights_reference) (?:INT64|STRING);\s*/g,
  '',
);

const sourceOptions = { values: [
  { option: 'Apex-owned or commissioned' },
  { option: 'Licensed stock' },
  { option: 'AI-generated with approved terms' },
] };

for (const path of ['n8n/01-launch-campaign.json', 'n8n/01-test-only-campaign-launcher.json']) {
  const workflow = load(path);
  const testOnly = path.includes('test-only');
  const trigger = find(workflow, testOnly ? 'Start selection preview' : 'Start a campaign');
  trigger.parameters.formFields.values = trigger.parameters.formFields.values.filter((field) => {
    const label = field.fieldLabel || '';
    const name = field.fieldName || '';
    return !/Topic [123] featured[- ]image/i.test(label) && !/^topic_[123]_(?:image_concept|featured_image_)/.test(name);
  });
  for (let number = 3; number >= 1; number -= 1) {
    const index = trigger.parameters.formFields.values.findIndex((field) =>
      (field.fieldName || field.fieldLabel) === `topic_${number}` || field.fieldLabel === `Topic ${number}`,
    );
    const named = (suffix) => testOnly ? {} : { fieldName: `topic_${number}_featured_image_${suffix}` };
    trigger.parameters.formFields.values.splice(index + 1, 0,
      { ...named('source_url'), fieldLabel: `Topic ${number} featured image central source URL`, fieldType: 'text', requiredField: true, placeholder: 'https://central-assets.example/path/image.jpg' },
      { ...named('alt_text'), fieldLabel: `Topic ${number} featured image alt text`, fieldType: 'text', requiredField: true },
      { ...named('source_type'), fieldLabel: `Topic ${number} featured image source type`, fieldType: 'dropdown', fieldOptions: sourceOptions, requiredField: true },
      { ...named('rights_reference'), fieldLabel: `Topic ${number} featured image rights or source reference`, fieldType: 'text', requiredField: true, placeholder: 'Asset record, license, commission, or generation reference' },
    );
  }

  const topicExpression = testOnly
    ? `const normalizeCentralAssetUrl = (value, number) => {
  const rawUrl = String(value ?? '').trim();
  if (!rawUrl) throw new Error('Topic ' + number + ' needs a featured image URL.');
  const match = rawUrl.match(/^https?:\\/\\/apexparent\\.hostmanpowered\\.com(\\/wp-content\\/uploads\\/[^?#]+)(?:\\?[^#]*)?(?:#.*)?$/i);
  if (!match) throw new Error('Topic ' + number + ' featured image must be an HTTP or HTTPS URL from the Apex Parent media library.');
  return 'https://apexparent.hostmanpowered.com' + match[1];
};
const topics = [1, 2, 3].map((number) => ({
  title: String(details['Topic ' + number] ?? '').trim(),
  featured_image_source_url: normalizeCentralAssetUrl(details['Topic ' + number + ' featured image central source URL'], number),
  featured_image_alt_text: String(details['Topic ' + number + ' featured image alt text'] ?? '').trim(),
  featured_image_source_type: String(details['Topic ' + number + ' featured image source type'] ?? '').trim(),
  featured_image_rights_reference: String(details['Topic ' + number + ' featured image rights or source reference'] ?? '').trim()
}));`
    : `const topics = [1, 2, 3].map((number) => ({
  title: value('topic_' + number, 'Topic ' + number),
  featured_image_source_url: value('topic_' + number + '_featured_image_source_url', 'Topic ' + number + ' featured image central source URL'),
  featured_image_alt_text: value('topic_' + number + '_featured_image_alt_text', 'Topic ' + number + ' featured image alt text'),
  featured_image_source_type: value('topic_' + number + '_featured_image_source_type', 'Topic ' + number + ' featured image source type'),
  featured_image_rights_reference: value('topic_' + number + '_featured_image_rights_reference', 'Topic ' + number + ' featured image rights or source reference')
}));`;
  const complete = `topics.some((topic) => !topic.title || !/^https:\\/\\//i.test(topic.featured_image_source_url) || topic.featured_image_alt_text.length < 8 || !topic.featured_image_source_type || !topic.featured_image_rights_reference)`;
  for (const entry of workflow.nodes) {
    if (!entry.parameters?.jsCode) continue;
    entry.parameters.jsCode = entry.parameters.jsCode
      .replace(/const normalizeCentralAssetUrl = \(value, number\) => \{[\s\S]*?\n\};\n(?=const (?:normalizeCentralAssetUrl|topics))/g, '')
      .replace(/const topics = \[1, 2, 3\]\.map\(\(number\) => \(\{[\s\S]*?\}\)\);/, topicExpression)
      .replace(/topics\.some\(\(topic\) => !topic\.title \|\| !Number\.isInteger\(topic\.featured_image_media_id\)[\s\S]*?!topic\.featured_image_rights_reference\)/, complete)
      .replace('three topics with verified WordPress image records', 'three topics with central image records');
  }
  const confirmation = workflow.nodes.find((entry) => entry.name === 'Form');
  if (confirmation?.parameters?.options?.formDescription) {
    confirmation.parameters.options.formDescription = confirmation.parameters.options.formDescription.replace(
      /\$json\.topics\.map\([^\n]+?\.join\(' \/ '\)/,
      "$json.topics.map(x => x.title + ' — ' + x.featured_image_alt_text).join(' / ')",
    );
  }

  const store = find(workflow, testOnly ? 'Store selected test campaign' : 'Store campaign and invitees');
  let sql = removeImageColumns(store.parameters.sqlQuery);
  sql = sql.replace(
    "ASSERT ARRAY_LENGTH(JSON_QUERY_ARRAY(p, '$.topics')) = 3 AS 'Exactly three topics are required.';",
    `ASSERT ARRAY_LENGTH(JSON_QUERY_ARRAY(p, '$.topics')) = 3 AS 'Exactly three topics are required.';\n${schemaSql}`,
  );
  sql = sql.replace(
    /INSERT INTO `apex-marketing-n8n\.automated_article_creation\.campaign_topics`[\s\S]*?FROM UNNEST\(JSON_QUERY_ARRAY\(p, '\$\.topics'\)\) AS topic WITH OFFSET AS zero_order\nCROSS JOIN UNNEST\(\[zero_order \+ 1\]\) AS sort_order;/,
    `INSERT INTO \`apex-marketing-n8n.automated_article_creation.campaign_topics\`
(topic_id, campaign_id, topic_title, topic_description, interview_guidance,
  featured_image_source_url, featured_image_alt_text, featured_image_source_type,
  featured_image_rights_reference, topic_sort_order, active, created_at)
SELECT CONCAT(v_campaign_id, '_topic_', CAST(sort_order AS STRING)), v_campaign_id,
  JSON_VALUE(topic, '$.title'), JSON_VALUE(topic, '$.title'), NULL,
  JSON_VALUE(topic, '$.featured_image_source_url'), JSON_VALUE(topic, '$.featured_image_alt_text'),
  JSON_VALUE(topic, '$.featured_image_source_type'), JSON_VALUE(topic, '$.featured_image_rights_reference'),
  sort_order, TRUE, CURRENT_TIMESTAMP()
FROM UNNEST(JSON_QUERY_ARRAY(p, '$.topics')) AS topic WITH OFFSET AS zero_order
CROSS JOIN UNNEST([zero_order + 1]) AS sort_order;`,
  );
  store.parameters.sqlQuery = sql;
  save(path, workflow);
}

const generationPath = 'n8n/06-generate-article.json';
const generation = load(generationPath);
const generationLoader = find(generation, 'Load Next Completed Interview');
let generationSql = removeImageColumns(generationLoader.parameters.sqlQuery);
generationSql = generationSql.replace('-- Load the newest substantive completed interview', `${schemaSql}\n\n-- Load the newest substantive completed interview`);
generationSql = generationSql.replace(
  /(?:  t\.featured_image_(?:media_id|media_url|source_url|alt_text|source_type|rights_reference),\n)+/,
  '  t.featured_image_source_url,\n  t.featured_image_alt_text,\n  t.featured_image_source_type,\n  t.featured_image_rights_reference,\n',
);
generationLoader.parameters.sqlQuery = generationSql;
const generationPrepare = find(generation, 'Prepare Article Generation Request');
generationPrepare.parameters.jsCode = generationPrepare.parameters.jsCode.replace(
  /  featured_image_(?:source_url|alt_text|source_type|rights_reference): interview\.featured_image_[^,\n]+,?\n/g,
  '',
).replace(
  '  interview_guidance: interview.interview_guidance,',
  `  interview_guidance: interview.interview_guidance,
  featured_image_alt_text: interview.featured_image_alt_text,
  featured_image_source_type: interview.featured_image_source_type,
  featured_image_rights_reference: interview.featured_image_rights_reference,`,
);
save(generationPath, generation);

const publisherPath = 'n8n/15-publish-approved-article-to-wordpress.json';
const publisher = load(publisherPath);
const loadApproved = find(publisher, 'Load Approved WordPress Article');
loadApproved.parameters.sqlQuery = loadApproved.parameters.sqlQuery
  .replace(
    'doctor_name STRING, location_code STRING, profile_url STRING, photo_url STRING, short_bio STRING,',
    'doctor_name STRING, credentials STRING, location_code STRING, profile_url STRING, photo_url STRING, short_bio STRING,',
  )
  .replace(
    'source STRING, verified_at TIMESTAMP, active BOOL\n);\nSELECT a.article_id,',
    `source STRING, verified_at TIMESTAMP, active BOOL
);
ALTER TABLE \`apex-marketing-n8n.automated_article_creation.doctor_profiles\`
  ADD COLUMN IF NOT EXISTS credentials STRING;
SELECT a.article_id,`,
  )
  .replace(
    'a.status AS article_status, a.current_version, d.doctor_name, d.credentials, LOWER(d.email) AS doctor_email,',
    "a.status AS article_status, a.current_version, COALESCE(NULLIF(TRIM(dp.doctor_name), ''), d.doctor_name) AS doctor_name, COALESCE(NULLIF(TRIM(dp.credentials), ''), d.credentials) AS credentials, LOWER(d.email) AS doctor_email,",
  )
  .replace(
    "a.status AS article_status, a.current_version, d.doctor_name, COALESCE(NULLIF(TRIM(dp.credentials), ''), d.credentials) AS credentials, LOWER(d.email) AS doctor_email,",
    "a.status AS article_status, a.current_version, COALESCE(NULLIF(TRIM(dp.doctor_name), ''), d.doctor_name) AS doctor_name, COALESCE(NULLIF(TRIM(dp.credentials), ''), d.credentials) AS credentials, LOWER(d.email) AS doctor_email,",
  );
loadApproved.parameters.sqlQuery = loadApproved.parameters.sqlQuery.replace(
  /  t\.featured_image_media_id, t\.featured_image_media_url, t\.featured_image_alt_text,\n  t\.featured_image_source_type, t\.featured_image_rights_reference,/,
  '  t.topic_id, t.featured_image_source_url, t.featured_image_alt_text,\n  t.featured_image_source_type, t.featured_image_rights_reference,',
);
const prepare = find(publisher, 'Prepare WordPress Publication');
prepare.parameters.jsCode = prepare.parameters.jsCode.replace(
  `if (!/class=["'][^"']*\\barticle-byline\\b/i.test(html)) {
  html = '<p class="article-byline">By <strong>' + escapeHtml(doctorLabel) + '</strong></p>\\n' + html;
}`,
  `html = html.replace(/<p\\b[^>]*class=["'][^"']*\\barticle-byline\\b[^"']*["'][^>]*>[\\s\\S]*?<\\/p>\\s*/gi, '');
html = '<p class="article-byline">By <strong>' + escapeHtml(doctorLabel) + '</strong></p>\\n' + html;`,
).replace(
  `if (!/class=["'][^"']*\\barticle-doctor-profile\\b/i.test(html)) {
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
}`,
  `html = html.replace(/<(section|div)\\b[^>]*class=["'][^"']*\\barticle-doctor-profile\\b[^"']*["'][^>]*>[\\s\\S]*?<\\/\\1>\\s*/gi, '');
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
html = html.slice(0, faqHeading.index) + profile + '\\n' + html.slice(faqHeading.index);`,
);
prepare.parameters.jsCode = prepare.parameters.jsCode.replace(
  /const featuredImageUrl = String\(row\.featured_image_media_url[\s\S]*?\n\}\nconst faqHeading/,
  `const featuredImageSourceUrl = requireHttpsUrl(row.featured_image_source_url, 'Featured image central source');
if (!featuredImageSourceUrl.startsWith('https://apexparent.hostmanpowered.com/wp-content/uploads/')) throw new Error('Featured images must come from the designated Apex Parent central Media Library.');
const featuredImageAlt = String(row.featured_image_alt_text || '').trim();
if (!featuredImageAlt) throw new Error('The selected topic image must include useful alt text.');
const faqHeading`,
).replace(
  /    \.\.\.\(Number\(row\.featured_image_media_id\) > 0 \? \{ featured_media: Number\(row\.featured_image_media_id\) \} : \{\}\),\n/,
  '',
).replace(/  wordpress_publication_base_url: publicationBaseUrl,\n/g, '').replace(/(?:  featured_image_source_url: featuredImageSourceUrl,\n  featured_image_alt_text: featuredImageAlt,\n  featured_image_media_slug: [^\n]+,\n  featured_image_upload_filename: [^\n]+,\n)+/g, '').replace(/(?:  featured_image_source_url: featuredImageSourceUrl,\n  featured_image_alt_text: featuredImageAlt,\n  featured_image_upload_filename: [^\n]+,\n)+/g, '').replace(
  '  title, seo_title: seoTitle, slug, excerpt, focus_keyphrase: focusKeyphrase, content: html,',
  `  title, seo_title: seoTitle, slug, excerpt, focus_keyphrase: focusKeyphrase, content: html,
  wordpress_publication_base_url: publicationBaseUrl,
  featured_image_source_url: featuredImageSourceUrl,
  featured_image_alt_text: featuredImageAlt,
  featured_image_media_slug: 'aac-' + String(row.topic_id || row.article_id).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  featured_image_upload_filename: 'aac-' + String(row.topic_id || row.article_id).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + (featuredImageSourceUrl.match(/\\.(?:jpe?g|png|webp)$/i)?.[0].toLowerCase() || '.jpg'),`,
);
if (!prepare.parameters.jsCode.includes('designated Apex Parent central Media Library')) {
  prepare.parameters.jsCode = prepare.parameters.jsCode.replace(
    "const featuredImageSourceUrl = requireHttpsUrl(row.featured_image_source_url, 'Featured image central source');",
    "const featuredImageSourceUrl = requireHttpsUrl(row.featured_image_source_url, 'Featured image central source');\nif (!featuredImageSourceUrl.startsWith('https://apexparent.hostmanpowered.com/wp-content/uploads/')) throw new Error('Featured images must come from the designated Apex Parent central Media Library.');",
  );
}
const centralImageBlock = `const featuredImageSourceUrl = requireHttpsUrl(row.featured_image_source_url, 'Featured image central source');
if (!featuredImageSourceUrl.startsWith('https://apexparent.hostmanpowered.com/wp-content/uploads/')) throw new Error('Featured images must come from the designated Apex Parent central Media Library.');
const featuredImageAlt = String(row.featured_image_alt_text || '').trim();
if (!featuredImageAlt) throw new Error('The selected topic image must include useful alt text.');
`;
while (prepare.parameters.jsCode.indexOf(centralImageBlock) !== prepare.parameters.jsCode.lastIndexOf(centralImageBlock)) {
  const second = prepare.parameters.jsCode.indexOf(centralImageBlock, prepare.parameters.jsCode.indexOf(centralImageBlock) + centralImageBlock.length);
  prepare.parameters.jsCode = prepare.parameters.jsCode.slice(0, second) + prepare.parameters.jsCode.slice(second + centralImageBlock.length);
}

const findExistingMedia = {
  parameters: {
    url: "={{ $json.wordpress_api_url + '/media?slug=' + encodeURIComponent($json.featured_image_media_slug) + '&per_page=1' }}",
    authentication: 'predefinedCredentialType', nodeCredentialType: 'wordpressApi', options: { timeout: 30000 },
  },
  type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [-40, -40],
  id: '6904d2ba-6055-5ac3-a151-956ef52fe8bd', name: 'Find Existing Topic Image in Target WordPress', alwaysOutputData: true,
};
const chooseMedia = {
  parameters: { mode: 'runOnceForAllItems', jsCode: `const context = $('Prepare WordPress Publication').first().json;
const candidates = $input.all().flatMap((item) => Array.isArray(item.json) ? item.json : [item.json]).filter((item) => item?.id);
const reusable = candidates.find((item) => String(item.slug || '') === context.featured_image_media_slug) || null;
return [{ json: { ...context, media_exists: Boolean(reusable), reusable_media: reusable } }];` },
  type: 'n8n-nodes-base.code', typeVersion: 2, position: [200, -40],
  id: 'd64164fe-44c7-5587-ae8e-569945d2a80d', name: 'Choose Existing or New Topic Image',
};
const ifMediaExists = {
  parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: 'topic-media-exists', leftValue: '={{ String($json.media_exists) }}', rightValue: 'true', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' }, options: {} },
  type: 'n8n-nodes-base.if', typeVersion: 2.2, position: [440, -40],
  id: '10177b5b-8ef8-5e78-8bf7-d4b2fbaf6dbe', name: 'If Topic Image Already Exists',
};
const reuseMedia = {
  parameters: { mode: 'runOnceForAllItems', jsCode: `const media = $json.reusable_media;
if (!media?.id) throw new Error('The reusable topic image record is missing.');
return [{ json: media }];` },
  type: 'n8n-nodes-base.code', typeVersion: 2, position: [680, -160],
  id: '7ae13e34-cf62-58a7-b350-c3806aa93d4e', name: 'Reuse Existing Topic Image',
};

const download = {
  parameters: {
    url: '={{ $json.featured_image_source_url }}',
    options: { timeout: 30000, response: { response: { responseFormat: 'file', outputPropertyName: 'data' } } },
  },
  type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [680, 120],
  id: '28c94083-1cf2-50ec-8bf1-c7ec4d02826f', name: 'Download Selected Campaign Image',
};
const upload = {
  parameters: {
    method: 'POST',
    url: "={{ $('Prepare WordPress Publication').first().json.wordpress_api_url + '/media' }}",
    authentication: 'predefinedCredentialType', nodeCredentialType: 'wordpressApi',
    sendHeaders: true,
    headerParameters: { parameters: [
      { name: 'Content-Disposition', value: "={{ 'attachment; filename=\\\"' + $('Prepare WordPress Publication').first().json.featured_image_upload_filename + '\\\"' }}" },
      { name: 'Content-Type', value: "={{ $binary.data.mimeType || 'image/jpeg' }}" },
    ] },
    sendBody: true, contentType: 'binaryData', inputDataFieldName: 'data', options: { timeout: 30000 },
  },
  type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [920, 120],
  id: 'f17742bb-d7d0-5233-845c-27d4af025687', name: 'Upload Campaign Image to Target WordPress',
};
const attach = {
  parameters: { mode: 'runOnceForAllItems', jsCode: `const media = $json;
const context = $('Prepare WordPress Publication').first().json;
if (!media?.id || !/^image\\//i.test(String(media.mime_type || ''))) throw new Error('WordPress did not return a valid uploaded image.');
const mediaUrl = String(media.source_url || media.guid?.rendered || '').trim();
if (!mediaUrl.startsWith(context.wordpress_publication_base_url + '/wp-content/uploads/')) throw new Error('WordPress returned an image outside the target subsite.');
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const figure = '<figure class="article-featured-image"><img src="' + escapeHtml(mediaUrl) + '" alt="' + escapeHtml(context.featured_image_alt_text) + '"></figure>';
const content = context.content.replace(/(<p\\b[^>]*class=["'][^"']*\\barticle-byline\\b[^"']*["'][^>]*>[\\s\\S]*?<\\/p>)/i, '$1\\n' + figure);
return [{ json: { ...context, content, uploaded_featured_image_media_id: Number(media.id), uploaded_featured_image_url: mediaUrl, wordpress_body: { ...context.wordpress_body, content, featured_media: Number(media.id) } } }];` },
  type: 'n8n-nodes-base.code', typeVersion: 2, position: [1160, -40],
  id: '3674ed2d-6f25-5169-a8ba-c844de156706', name: 'Attach Uploaded Campaign Image',
};
publisher.nodes = publisher.nodes.filter((entry) => ![findExistingMedia.name, chooseMedia.name, ifMediaExists.name, reuseMedia.name, download.name, upload.name, attach.name].includes(entry.name));
publisher.nodes.push(findExistingMedia, chooseMedia, ifMediaExists, reuseMedia, download, upload, attach);
find(publisher, 'Prepare WordPress Publication').position = [-280, -40];
find(publisher, 'Find Existing WordPress Post').position = [1400, -40];
find(publisher, 'Choose WordPress Create or Update').position = [1640, -40];
find(publisher, 'Publish WordPress Post').position = [1880, -40];
find(publisher, 'Validate WordPress Publication').position = [2120, -40];
find(publisher, 'Record Successful Publication').position = [2360, -40];
publisher.connections['Prepare WordPress Publication'] = { main: [[{ node: findExistingMedia.name, type: 'main', index: 0 }]] };
publisher.connections[findExistingMedia.name] = { main: [[{ node: chooseMedia.name, type: 'main', index: 0 }]] };
publisher.connections[chooseMedia.name] = { main: [[{ node: ifMediaExists.name, type: 'main', index: 0 }]] };
publisher.connections[ifMediaExists.name] = { main: [
  [{ node: reuseMedia.name, type: 'main', index: 0 }],
  [{ node: download.name, type: 'main', index: 0 }],
] };
publisher.connections[reuseMedia.name] = { main: [[{ node: attach.name, type: 'main', index: 0 }]] };
publisher.connections[download.name] = { main: [[{ node: upload.name, type: 'main', index: 0 }]] };
publisher.connections[upload.name] = { main: [[{ node: attach.name, type: 'main', index: 0 }]] };
publisher.connections[attach.name] = { main: [[{ node: 'Find Existing WordPress Post', type: 'main', index: 0 }]] };
const choose = find(publisher, 'Choose WordPress Create or Update');
choose.parameters.jsCode = choose.parameters.jsCode.replace("$('Prepare WordPress Publication')", "$('Attach Uploaded Campaign Image')");
const validate = find(publisher, 'Validate WordPress Publication');
validate.parameters.jsCode = validate.parameters.jsCode.replace("$('Choose WordPress Create or Update').first().json", "$('Choose WordPress Create or Update').first().json");
validate.parameters.jsCode = validate.parameters.jsCode.replace(
  /if \(Number\(context\.featured_image_media_id\)[^\n]+\n/,
  "if (Number(response.featured_media) !== Number(context.uploaded_featured_image_media_id)) throw new Error('WordPress did not retain the automatically uploaded topic image.');\n",
);
save(publisherPath, publisher);
