// Adds the automated local SEO review (Brenna's "AEO/SEO Page Updates" GPT rules) to the
// article-generation workflow, between "Validate and Parse Article Package" and
// "Persist Initial Article Draft". Safe to re-run: it refreshes the nodes and embedded prompt.
import fs from 'node:fs';

const workflowPath = new URL('../n8n/06-generate-article.json', import.meta.url);
const promptPath = new URL('../prompts/local-seo-review-prompt.md', import.meta.url);
const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
const prompt = fs.readFileSync(promptPath, 'utf8');

const VALIDATE = 'Validate and Parse Article Package';
const PREPARE = 'Prepare Local SEO Review';
const RUN = 'Run Local SEO Review';
const APPLY = 'Apply Local SEO Changes';
const PERSIST = 'Persist Initial Article Draft';

const prepareCode = String.raw`// Sends the validated first draft through the automated local SEO review before doctor review.
const article = $json;
const context = $('Prepare Article Generation Request').first().json;
const instructions = __PROMPT__;
const input = [
  'ARTICLE TOPIC',
  String(context.topic_title || article.metadata?.primary_search_intent || ''),
  '',
  'ARTICLE HTML',
  String(article.article_html || '')
].join('\n');
const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['changes'],
  properties: {
    changes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['element', 'current', 'change_to'],
        properties: {
          element: { type: 'string', enum: ['h1', 'h2', 'body_paragraph', 'faq_question', 'faq_answer'] },
          current: { type: 'string' },
          change_to: { type: 'string' }
        }
      }
    }
  }
};
return [{ json: {
  ...article,
  local_seo_body: {
    model: 'gpt-6-astra',
    instructions,
    input,
    text: { format: { type: 'json_schema', name: 'local_seo_changes', strict: true, schema } },
    max_output_tokens: 8000
  }
} }];`;

const applyCode = String.raw`// Applies only safe local SEO changes. Medical wording in paragraphs and FAQ answers can only gain
// short additions; anything else is skipped. If the review fails, the draft continues unchanged.
const response = $json;
const { local_seo_body, ...article } = $('Prepare Local SEO Review').first().json;
const allowedFields = ['[hh_short name="practice_city_and_state"]', '[sc name="practice_name"][/sc]', '[sc name="practice_phone_number"][/sc]'];
const withoutAllowedFields = (value) => allowedFields.reduce((text, field) => text.split(field).join(' '), String(value));
const hasUnknownShortcode = (value) => /\[\/?[A-Za-z_][^\]]*\]/.test(withoutAllowedFields(value));
const tagsOf = (value) => (String(value).match(/<[^>]+>/g) || []).join('|');
const plainText = (value) => String(value).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const wordsOf = (value) => withoutAllowedFields(plainText(value)).toLowerCase().replace(/&[a-z#0-9]+;/g, ' ').match(/[a-z0-9]+/g) || [];
const keepsEveryWord = (current, next) => {
  const before = wordsOf(current);
  const after = wordsOf(next);
  let index = 0;
  for (const word of after) if (index < before.length && word === before[index]) index += 1;
  return index === before.length && after.length - before.length <= 30;
};
const escapeRegExp = (value) => String(value).replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
const tagFor = { h1: 'h1', h2: 'h2', faq_question: 'h3', body_paragraph: 'p', faq_answer: 'p' };

let changes = [];
let failure = '';
if (response?.error) {
  failure = 'the AI request failed';
} else {
  const message = (response?.output || []).find((item) => item.type === 'message');
  const text = message?.content?.find((item) => item.type === 'output_text')?.text;
  try {
    changes = JSON.parse(text || '').changes || [];
  } catch {
    failure = 'the AI response could not be read';
  }
}

let html = String(article.article_html || '');
let review = String(article.review_document_markdown || '');
const metadata = { ...(article.metadata || {}) };
const applied = [];
const skipped = [];
for (const change of Array.isArray(changes) ? changes : []) {
  const element = String(change?.element || '');
  const current = String(change?.current || '');
  const next = String(change?.change_to || '');
  const tag = tagFor[element];
  const skip = (reason) => skipped.push({ element, current, change_to: next, reason });
  if (!tag || !current.trim() || !next.trim() || current === next) { skip('empty or unchanged'); continue; }
  if (hasUnknownShortcode(next)) { skip('uses a website field that is not on the approved list'); continue; }
  if (tagsOf(current) !== tagsOf(next)) { skip('adds, removes, or changes HTML or links'); continue; }
  if (element === 'h1' && /[\[\]<>]/.test(next)) { skip('the title cannot contain website fields or HTML'); continue; }
  if ((element === 'body_paragraph' || element === 'faq_answer') && !keepsEveryWord(current, next)) { skip('would change existing wording instead of only adding to it'); continue; }
  if (/^\s*<strong>\s*By\s/i.test(current)) { skip('the byline is not changed'); continue; }
  const pattern = new RegExp('<' + tag + '(\\s[^>]*)?>' + escapeRegExp(current) + '</' + tag + '>', 'g');
  const matches = [...html.matchAll(pattern)];
  if (matches.length !== 1) { skip(matches.length ? 'matches more than one place' : 'current text was not found'); continue; }
  const at = matches[0].index;
  const faq = html.match(/<section[^>]*class=["'][^"']*\baac-article-faq\b[^"']*["'][^>]*>[\s\S]*?<\/section>/i);
  const insideFaq = faq ? at > faq.index && at < faq.index + faq[0].length : false;
  const bioStart = html.indexOf('<!-- AAC_AUTHOR_BIO_START -->');
  if (bioStart !== -1 && at > bioStart) { skip('the doctor biography is not changed'); continue; }
  if ((element === 'faq_question' || element === 'faq_answer') !== insideFaq && element !== 'h1' && element !== 'h2') { skip('not in the expected part of the article'); continue; }
  const replacement = matches[0][0].replace('>' + current + '</', '>' + next + '</');
  html = html.slice(0, at) + replacement + html.slice(at + matches[0][0].length);
  if (element === 'h1') metadata.h1 = plainText(next);
  const currentText = plainText(current);
  const nextText = plainText(next);
  if (currentText && review.split(currentText).length === 2) review = review.replace(currentText, nextText);
  applied.push({ element, current, change_to: next });
}

const label = { h1: 'H1', h2: 'H2', body_paragraph: 'Body paragraph', faq_question: 'FAQ question', faq_answer: 'FAQ answer' };
const notes = ['', '', '## Local SEO Updates (automated)', ''];
if (failure) {
  notes.push('The automated local SEO review did not run because ' + failure + '. Marketing should check practice name and city references by hand before publishing.');
} else if (applied.length) {
  notes.push('The automated local SEO review (based on the "AEO/SEO Page Updates" GPT) made these wording changes before doctor review. Existing medical wording was kept; paragraphs and FAQ answers only received short additions.', '');
  for (const item of applied) notes.push('- **' + label[item.element] + '**: "' + plainText(item.current) + '" changed to "' + plainText(item.change_to) + '"');
} else {
  notes.push('The automated local SEO review recommended no changes.');
}
if (skipped.length) notes.push('', skipped.length + ' suggested change(s) were not applied because they did not meet the safety rules.');
review = review.trimEnd() + notes.join('\n') + '\n';

let storedPackage = {};
try { storedPackage = JSON.parse(article.package_json || '{}'); } catch { storedPackage = {}; }
storedPackage.article_html = html;
storedPackage.review_document_markdown = review;
storedPackage.metadata = metadata;
storedPackage.local_seo_review = {
  status: failure ? 'FAILED' : 'COMPLETED',
  failure_reason: failure || null,
  openai_response_id: response?.id || null,
  applied,
  skipped,
  reviewed_at: new Date().toISOString()
};
return [{ json: { ...article, article_html: html, review_document_markdown: review, metadata, package_json: JSON.stringify(storedPackage) } }];`;

const generate = workflow.nodes.find((node) => node.name === 'Generate Researched Article Package');
const validate = workflow.nodes.find((node) => node.name === VALIDATE);
if (!generate || !validate || !workflow.nodes.some((node) => node.name === PERSIST)) {
  throw new Error('Workflow 06 is missing an expected node.');
}
const [x, y] = validate.position;
const upsert = (definition) => {
  const existing = workflow.nodes.find((node) => node.name === definition.name);
  if (existing) Object.assign(existing, definition, { id: existing.id });
  else workflow.nodes.push(definition);
};
upsert({
  parameters: { jsCode: prepareCode.replace('__PROMPT__', () => JSON.stringify(prompt)) },
  id: 'aac-06-prepare-local-seo-review',
  name: PREPARE,
  type: 'n8n-nodes-base.code',
  typeVersion: validate.typeVersion,
  position: [x + 220, y + 200],
});
upsert({
  parameters: {
    ...structuredClone(generate.parameters),
    body: '={{ JSON.stringify($json.local_seo_body) }}',
    options: { timeout: 300000 },
  },
  id: 'aac-06-run-local-seo-review',
  name: RUN,
  type: generate.type,
  typeVersion: generate.typeVersion,
  position: [x + 440, y + 200],
  onError: 'continueRegularOutput',
});
upsert({
  parameters: { jsCode: applyCode },
  id: 'aac-06-apply-local-seo-changes',
  name: APPLY,
  type: 'n8n-nodes-base.code',
  typeVersion: validate.typeVersion,
  position: [x + 660, y + 200],
});
const connect = (from, to) => {
  workflow.connections[from] = { main: [[{ node: to, type: 'main', index: 0 }]] };
};
connect(VALIDATE, PREPARE);
connect(PREPARE, RUN);
connect(RUN, APPLY);
connect(APPLY, PERSIST);
fs.writeFileSync(workflowPath, `${JSON.stringify(workflow, null, 2)}\n`);
