import { readFileSync, writeFileSync } from 'node:fs';

const pilotCampaign = 'campaign_test_202609_aac_prestonwood_pilot_2026_09_23';
const pilotEmail = 'jdold@apexdp.com';
const pilotPublicUrl = 'https://prestonwooddentistry.com';
const pilotWordPressBase = 'https://apexparent.hostmanpowered.com/dfw-03';
const testWordPressBase = 'https://apexparent.hostmanpowered.com/test001';

function load(name) {
  return JSON.parse(readFileSync(`n8n/${name}.json`, 'utf8'));
}
function save(name, workflow) {
  writeFileSync(`n8n/${name}.json`, `${JSON.stringify(workflow, null, 2)}\n`);
}
function node(workflow, name) {
  const found = workflow.nodes.find((item) => item.name === name);
  if (!found) throw new Error(`Missing n8n node: ${name}`);
  return found;
}
function once(source, before, after, label) {
  if (source.includes(after)) return source;
  if (source.split(before).length !== 2) throw new Error(`Expected one ${label} anchor`);
  return source.replace(before, after);
}

const publisher = load('15-publish-approved-article-to-wordpress');
const loadArticle = node(publisher, 'Load Approved WordPress Article');
loadArticle.parameters.sqlQuery = once(
  loadArticle.parameters.sqlQuery,
  'a.current_version, d.doctor_name, d.credentials,',
  'a.current_version, d.doctor_name, d.credentials, LOWER(d.email) AS doctor_email,',
  'publisher doctor identity',
);
const prepare = node(publisher, 'Prepare WordPress Publication');
prepare.parameters.jsCode = once(
  prepare.parameters.jsCode,
  `if (row.practice_id !== 'practice_test_001' || wordpressBaseUrl !== '${testWordPressBase}') {\n  throw new Error('Automatic publication is restricted to the TEST-1 WordPress subsite.');\n}\nconst appointmentUrl = String(config.appointment_url || publicUrl);`,
  `if (row.practice_id !== 'practice_test_001' || wordpressBaseUrl !== '${testWordPressBase}') {\n  throw new Error('Automatic publication is restricted to the TEST-1 practice and its verified base configuration.');\n}\nconst pilotCampaign = '${pilotCampaign}';\nconst isPrestonwoodPilot = row.campaign_id === pilotCampaign;\nif (isPrestonwoodPilot && String(row.doctor_email || '').toLowerCase() !== '${pilotEmail}') {\n  throw new Error('The Prestonwood pilot permits only the named test identity.');\n}\nconst publicationBaseUrl = isPrestonwoodPilot ? '${pilotWordPressBase}' : wordpressBaseUrl;\nconst appointmentUrl = isPrestonwoodPilot ? '${pilotPublicUrl}' : String(config.appointment_url || publicUrl);`,
  'publisher pilot boundary',
);
prepare.parameters.jsCode = once(
  prepare.parameters.jsCode,
  'wordpress_api_url: `${wordpressBaseUrl}/wp-json/wp/v2`,',
  'wordpress_api_url: `${publicationBaseUrl}/wp-json/wp/v2`,',
  'publisher API route',
);
const publisherNote = node(publisher, 'Phase 1J Publishing Notes');
if (!publisherNote.parameters.content.includes('Pilot exception: only campaign')) publisherNote.parameters.content += `\n\nPilot exception: only campaign \`${pilotCampaign}\` and doctor email \`${pilotEmail}\` may route from the TEST001 test practice to \`${pilotWordPressBase}\`. The TEST001 configuration must still match exactly before the exception applies. All other campaigns retain TEST001. This is a WordPress publication, not a Headless Hostman static release.`;
save('15-publish-approved-article-to-wordpress', publisher);

const marketing = load('18-send-marketing-review-invitation');
const prepareLink = node(marketing, 'Prepare Fresh Marketing Review Link');
prepareLink.parameters.sqlQuery = once(
  prepareLink.parameters.sqlQuery,
  'SELECT a.article_id, a.current_version, ap.deadline,',
  'SELECT a.article_id, a.campaign_id, LOWER(d.email) AS doctor_email, a.current_version, ap.deadline,',
  'marketing candidate identity',
);
prepareLink.parameters.sqlQuery = once(
  prepareLink.parameters.sqlQuery,
  'FROM `apex-marketing-n8n.automated_article_creation.articles` a\nJOIN `apex-marketing-n8n.automated_article_creation.approvals` ap',
  'FROM `apex-marketing-n8n.automated_article_creation.articles` a\nJOIN `apex-marketing-n8n.automated_article_creation.doctors` d ON d.doctor_id = a.doctor_id\nJOIN `apex-marketing-n8n.automated_article_creation.approvals` ap',
  'marketing doctor join',
);
prepareLink.parameters.sqlQuery = once(
  prepareLink.parameters.sqlQuery,
  'SELECT GENERATE_UUID() AS marketing_review_link_id, article_id, current_version, article_title,',
  'SELECT GENERATE_UUID() AS marketing_review_link_id, article_id, campaign_id, doctor_email, current_version, article_title,',
  'marketing link identity',
);
prepareLink.parameters.sqlQuery = once(
  prepareLink.parameters.sqlQuery,
  'SELECT article_id, current_version, article_title, marketing_review_link_id,',
  'SELECT article_id, campaign_id, doctor_email, current_version, article_title, marketing_review_link_id,',
  'marketing output identity',
);
const prepareMail = node(marketing, 'Prepare Marketing Review Email');
prepareMail.parameters.jsCode = `const pilotCampaign = '${pilotCampaign}';\nconst isPrestonwoodPilot = $json.campaign_id === pilotCampaign;\nif (isPrestonwoodPilot && String($json.doctor_email || '').toLowerCase() !== '${pilotEmail}') {\n  throw new Error('The Prestonwood pilot permits only the named test identity.');\n}\nreturn { json: {\n  article_id: $json.article_id,\n  current_version: $json.current_version,\n  recipient: isPrestonwoodPilot ? '${pilotEmail}' : 'ndorsey@apexdp.com',\n  cc_list: isPrestonwoodPilot ? '' : 'ballen@apexdp.com, jdold@apexdp.com',\n  subject: 'Article ready for marketing review',\n  message_text: ['An article is ready for marketing review:', '', $json.article_title || 'Article draft', '', 'Approve it or request changes using this secure link:', $json.review_url, '', isPrestonwoodPilot ? 'This is the Prestonwood test campaign; only you received this marketing invitation.' : 'This review is shared with three marketing reviewers. The first submitted decision controls the next step; after approval, the article remains available to preview.', '', 'Apex Dental Partners'].join(String.fromCharCode(10)),\n} };`;
node(marketing, 'Email Marketing Reviewer').parameters.options.ccList = '={{ $json.cc_list }}';
save('18-send-marketing-review-invitation', marketing);

const generation = load('06-generate-article');
const generationRequest = node(generation, 'Prepare Article Generation Request');
generationRequest.parameters.jsCode = once(
  generationRequest.parameters.jsCode,
  'const practiceContext = {\n  doctor_name: interview.doctor_name,',
  `const pilotCampaign = '${pilotCampaign}';\nconst isPrestonwoodPilot = interview.campaign_id === pilotCampaign;\nif (isPrestonwoodPilot && (interview.practice_id !== 'practice_test_001' || String(interview.doctor_id || '').toLowerCase() !== 'doctor_jdold_apexdp_com')) {\n  throw new Error('The Prestonwood pilot requires the named test doctor and TEST001 practice.');\n}\nconst practiceContext = {\n  doctor_name: interview.doctor_name,`,
  'generation pilot identity',
);
generationRequest.parameters.jsCode = once(
  generationRequest.parameters.jsCode,
  'practice_name: interview.practice_name,\n  practice_id: interview.practice_id,\n  website_domain: interview.website_domain,\n  publisher_config_reference: interview.publisher_config_reference,',
  `practice_name: isPrestonwoodPilot ? 'Prestonwood Family Dentistry' : interview.practice_name,\n  practice_id: interview.practice_id,\n  website_domain: isPrestonwoodPilot ? '${pilotPublicUrl}' : interview.website_domain,\n  publisher_config_reference: interview.publisher_config_reference,`,
  'generation practice context',
);
save('06-generate-article', generation);

const revision = load('10-revise-article-from-doctor-feedback');
const revisionRequest = node(revision, 'Prepare Revision Request');
revisionRequest.parameters.jsCode = once(
  revisionRequest.parameters.jsCode,
  'const practiceContext = {\n  doctor_name: revision.doctor_name,',
  `const isPrestonwoodPilot = revision.campaign_id === '${pilotCampaign}';\nif (isPrestonwoodPilot && (revision.practice_id !== 'practice_test_001' || String(revision.doctor_id || '').toLowerCase() !== 'doctor_jdold_apexdp_com')) {\n  throw new Error('The Prestonwood pilot requires the named test doctor and TEST001 practice.');\n}\nconst practiceContext = {\n  doctor_name: revision.doctor_name,`,
  'revision pilot identity',
);
revisionRequest.parameters.jsCode = once(
  revisionRequest.parameters.jsCode,
  'practice_name: revision.practice_name,\n  website_domain: revision.website_domain,\n  publisher_config_reference: revision.publisher_config_reference,',
  `practice_name: isPrestonwoodPilot ? 'Prestonwood Family Dentistry' : revision.practice_name,\n  website_domain: isPrestonwoodPilot ? '${pilotPublicUrl}' : revision.website_domain,\n  publisher_config_reference: revision.publisher_config_reference,`,
  'revision practice context',
);
save('10-revise-article-from-doctor-feedback', revision);
