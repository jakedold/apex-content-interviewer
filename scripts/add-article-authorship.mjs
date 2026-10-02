import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const workflows = [
  ['n8n/06-generate-article.json', 'Load Next Completed Interview', 'Prepare Article Generation Request', 'Validate and Parse Article Package'],
  ['n8n/10-revise-article-from-doctor-feedback.json', 'Load Requested Revision', 'Prepare Revision Request', 'Validate Revised Package'],
  ['n8n/20-revise-article-from-marketing-feedback.json', 'Load Marketing Revision Request', 'Prepare Marketing Revision Request', 'Validate Marketing Revision'],
];

const authorshipFunction = `
const escapeAuthorHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');
const ensureArticleAuthorship = (sourceHtml) => {
  const authorName = String(context.author_name || context.doctor_name || '').trim();
  const credentials = String(context.credentials || '').trim();
  const authorBio = String(context.author_bio || '').trim();
  const profileUrl = String(context.profile_url || '').trim();
  if (!authorName || !credentials || !authorBio) {
    throw new Error('Verified author name, credentials, and bio are required before an article can be generated or revised.');
  }
  let result = String(sourceHtml || '')
    .replace(/\\s*<!-- AAC_AUTHOR_BYLINE_START -->[\\s\\S]*?<!-- AAC_AUTHOR_BYLINE_END -->\\s*/gi, '\\n')
    .replace(/\\s*<!-- AAC_AUTHOR_BIO_START -->[\\s\\S]*?<!-- AAC_AUTHOR_BIO_END -->\\s*/gi, '\\n');
  const h1 = result.match(/<h1(?:\\s[^>]*)?>[\\s\\S]*?<\\/h1>/i);
  if (!h1 || h1.index === undefined) throw new Error('Production HTML is missing its H1.');
  const displayName = [authorName, credentials].filter(Boolean).join(', ');
  const byline = '<!-- AAC_AUTHOR_BYLINE_START -->\\n<p><strong>By ' + escapeAuthorHtml(displayName) + '</strong></p>\\n<!-- AAC_AUTHOR_BYLINE_END -->';
  const profileLink = /^https:\\/\\//i.test(profileUrl)
    ? '\\n<p><a href="' + escapeAuthorHtml(profileUrl) + '">Learn more about ' + escapeAuthorHtml(authorName) + '</a></p>'
    : '';
  const bio = '<!-- AAC_AUTHOR_BIO_START -->\\n<h2>About ' + escapeAuthorHtml(authorName) + '</h2>\\n<p>' + escapeAuthorHtml(authorBio) + '</p>' + profileLink + '\\n<!-- AAC_AUTHOR_BIO_END -->';
  const insertAt = h1.index + h1[0].length;
  result = result.slice(0, insertAt) + '\\n' + byline + result.slice(insertAt);
  return result.trim() + '\\n\\n' + bio;
};
`;

for (const [file, loadName, prepareName, validateName] of workflows) {
  const url = new URL(file, root);
  const workflow = JSON.parse(fs.readFileSync(url, 'utf8'));
  const load = workflow.nodes.find((node) => node.name === loadName);
  const prepare = workflow.nodes.find((node) => node.name === prepareName);
  const validate = workflow.nodes.find((node) => node.name === validateName);
  if (!load || !prepare || !validate) throw new Error(`${file}: required node missing`);

  if (!load.parameters.sqlQuery.includes('d.author_bio')) {
    load.parameters.sqlQuery = load.parameters.sqlQuery.replace(
      '  d.credentials,',
      "  d.credentials,\n  COALESCE(NULLIF(TRIM(d.author_name), ''), d.doctor_name) AS author_name,\n  d.author_bio,\n  d.profile_url,\n  d.photo_source_url,"
    );
  }

  const contextVariable = file.includes('06-') ? 'interview' : 'revision';
  if (!prepare.parameters.jsCode.includes('doctor_bio:')) {
    prepare.parameters.jsCode = prepare.parameters.jsCode.replace(
      '  doctor_credentials:',
      `  doctor_author_name: ${contextVariable}.author_name,\n  doctor_bio: ${contextVariable}.author_bio,\n  doctor_profile_url: ${contextVariable}.profile_url,\n  doctor_credentials:`
    );
  } else if (prepare.parameters.jsCode.includes("${file.includes('06-')")) {
    prepare.parameters.jsCode = prepare.parameters.jsCode.replace(
      /  doctor_author_name:.*\n  doctor_bio:.*\n  doctor_profile_url:.*\n/,
      `  doctor_author_name: ${contextVariable}.author_name,\n  doctor_bio: ${contextVariable}.author_bio,\n  doctor_profile_url: ${contextVariable}.profile_url,\n`
    );
  }

  if (!prepare.parameters.jsCode.includes('The Doctor Profiles row must be completed')) {
    const preflightAnchor = file.includes('06-')
      ? "if (!interview.interview_id || !interview.transcript) {"
      : "if (!revision.article_id || !revision.current_package_json || !revision.revision_instruction) {";
    prepare.parameters.jsCode = prepare.parameters.jsCode.replace(
      preflightAnchor,
      `if (!${contextVariable}.author_name || !${contextVariable}.credentials || !${contextVariable}.author_bio) {\n  throw new Error('The Doctor Profiles row must be completed and marked Active before this article can move forward.');\n}\n\n${preflightAnchor}`
    );
  }

  if (!validate.parameters.jsCode.includes('ensureArticleAuthorship')) {
    validate.parameters.jsCode = validate.parameters.jsCode.replace(
      "const context = $('" + prepareName + "').first().json;",
      "const context = $('" + prepareName + "').first().json;\n" + authorshipFunction
    );
    validate.parameters.jsCode = validate.parameters.jsCode.replace(
      'const html = publicationPackage.article_html || \'\';',
      "const html = ensureArticleAuthorship(publicationPackage.article_html || '');"
    );
  }

  fs.writeFileSync(url, `${JSON.stringify(workflow, null, 2)}\n`);
}

const publisherUrl = new URL('n8n/15-publish-approved-article-to-wordpress.json', root);
const publisher = JSON.parse(fs.readFileSync(publisherUrl, 'utf8'));
const preparePublication = publisher.nodes.find((node) => node.name === 'Prepare WordPress Publication');
if (!preparePublication) throw new Error('WordPress publisher: preparation node missing');
if (!preparePublication.parameters.jsCode.includes('AAC_AUTHOR_(?:BYLINE|BIO)')) {
  preparePublication.parameters.jsCode = preparePublication.parameters.jsCode.replace(
    "  .trim();\n\nconst title",
    "  .replace(/<!-- AAC_AUTHOR_(?:BYLINE|BIO)_(?:START|END) -->/gi, '')\n  .trim();\n\nconst title"
  );
}
fs.writeFileSync(publisherUrl, `${JSON.stringify(publisher, null, 2)}\n`);
