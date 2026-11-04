import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const workflow = JSON.parse(fs.readFileSync(new URL('../n8n/06-generate-article.json', import.meta.url), 'utf8'));
const node = (name) => workflow.nodes.find((entry) => entry.name === name);
const city = '[hh_short name="practice_city_and_state"]';
const draftHtml = [
  '<!-- SEO_TITLE: Bleeding gums -->',
  '<h1>Bleeding Gums: Why Look Beyond Your Toothbrush?</h1>',
  '<!-- AAC_AUTHOR_BYLINE_START -->\n<p><strong>By Dr. Test, DDS</strong></p>\n<!-- AAC_AUTHOR_BYLINE_END -->',
  '<h2>What Causes It</h2>',
  '<p>Plaque irritates the gums and causes bleeding in 50% of adults.</p>',
  '<p>See the <a href="https://www.ada.org/">ADA guidance</a> for brushing.</p>',
  '<p>Our team can evaluate your gums at a routine visit.</p>',
  '<section class="aac-article-faq"><h2>Frequently Asked Questions</h2><h3>Is bleeding normal?</h3><p>It is common but not normal.</p></section>',
  '<!-- AAC_AUTHOR_BIO_START -->\n<h2>About Dr. Test</h2>\n<p>Dr. Test is a placeholder dentist.</p>\n<!-- AAC_AUTHOR_BIO_END -->',
].join('\n');
const validated = {
  article_id: 'article_test',
  article_html: draftHtml,
  review_document_markdown: '# Review\n\n## What Causes It\n\nPlaque irritates the gums and causes bleeding in 50% of adults.\n' + 'x'.repeat(1000),
  metadata: { h1: 'Bleeding Gums: Why Look Beyond Your Toothbrush?', slug: 'bleeding-gums' },
  package_json: JSON.stringify({ article_html: draftHtml, metadata: {} }),
  openai_response_id: 'resp_draft',
};

const prepare = () => new Function('$json', '$', node('Prepare Local SEO Review').parameters.jsCode)(
  validated,
  () => ({ first: () => ({ json: { topic_title: 'Bleeding gums' } }) }),
)[0].json;
const apply = (response) => {
  const prepared = prepare();
  return new Function('$json', '$', node('Apply Local SEO Changes').parameters.jsCode)(response, () => ({ first: () => ({ json: prepared }) }))[0].json;
};
const reply = (changes) => ({ id: 'resp_seo', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ changes }) }] }] });

test('the local SEO review runs between draft validation and saving the draft, with Brenna\'s rules', () => {
  assert.deepEqual(workflow.connections['Validate and Parse Article Package'].main[0].map((c) => c.node), ['Prepare Local SEO Review']);
  assert.deepEqual(workflow.connections['Prepare Local SEO Review'].main[0].map((c) => c.node), ['Run Local SEO Review']);
  assert.deepEqual(workflow.connections['Run Local SEO Review'].main[0].map((c) => c.node), ['Apply Local SEO Changes']);
  assert.deepEqual(workflow.connections['Apply Local SEO Changes'].main[0].map((c) => c.node), ['Persist Initial Article Draft']);
  assert.equal(node('Run Local SEO Review').onError, 'continueRegularOutput');
  assert.equal(node('Run Local SEO Review').credentials, undefined);
  const body = prepare().local_seo_body;
  assert.match(body.instructions, /AEO\/SEO Page Updates/);
  assert.match(body.instructions, /MEDICAL CONTENT PROTECTION/);
  assert.match(body.input, /Bleeding Gums: Why Look Beyond Your Toothbrush\?/);
});

test('safe heading rewrites and location additions are applied and listed for reviewers', () => {
  const result = apply(reply([
    { element: 'h1', current: 'Bleeding Gums: Why Look Beyond Your Toothbrush?', change_to: 'Why Do My Gums Bleed When I Brush My Teeth?' },
    { element: 'h2', current: 'What Causes It', change_to: 'What Causes Bleeding Gums?' },
    { element: 'body_paragraph', current: 'Our team can evaluate your gums at a routine visit.', change_to: 'Our team in ' + city + ' can evaluate your gums at a routine visit.' },
    { element: 'faq_question', current: 'Is bleeding normal?', change_to: 'Is it normal for my gums to bleed when brushing?' },
  ]));
  assert.match(result.article_html, /<h1>Why Do My Gums Bleed When I Brush My Teeth\?<\/h1>/);
  assert.match(result.article_html, /<h2>What Causes Bleeding Gums\?<\/h2>/);
  assert.ok(result.article_html.includes('<p>Our team in ' + city + ' can evaluate'));
  assert.match(result.article_html, /<h3>Is it normal for my gums to bleed when brushing\?<\/h3>/);
  assert.equal(result.metadata.h1, 'Why Do My Gums Bleed When I Brush My Teeth?');
  assert.match(result.review_document_markdown, /## What Causes Bleeding Gums\?/);
  assert.match(result.review_document_markdown, /## Local SEO Updates \(automated\)/);
  const stored = JSON.parse(result.package_json);
  assert.equal(stored.article_html, result.article_html);
  assert.equal(stored.local_seo_review.status, 'COMPLETED');
  assert.equal(stored.local_seo_review.applied.length, 4);
  assert.equal(result.openai_response_id, 'resp_draft');
  assert.equal(result.local_seo_body, undefined);
});

test('changes to medical wording, links, the title, the byline, or the bio are refused', () => {
  const result = apply(reply([
    { element: 'body_paragraph', current: 'Plaque irritates the gums and causes bleeding in 50% of adults.', change_to: 'Plaque causes bleeding in most adults in ' + city + '.' },
    { element: 'body_paragraph', current: 'See the <a href="https://www.ada.org/">ADA guidance</a> for brushing.', change_to: 'See the ADA guidance for brushing.' },
    { element: 'h1', current: 'Bleeding Gums: Why Look Beyond Your Toothbrush?', change_to: 'Bleeding Gums in ' + city },
    { element: 'body_paragraph', current: '<strong>By Dr. Test, DDS</strong>', change_to: '<strong>By Dr. Test, DDS, in ' + city + '</strong>' },
    { element: 'body_paragraph', current: 'Dr. Test is a placeholder dentist.', change_to: 'Dr. Test is a placeholder dentist in ' + city + '.' },
    { element: 'faq_answer', current: 'It is common but not normal.', change_to: 'It is common but not normal [sc name="unknown_field"][/sc].' },
  ]));
  assert.equal(result.article_html, draftHtml);
  const stored = JSON.parse(result.package_json);
  assert.equal(stored.local_seo_review.applied.length, 0);
  assert.equal(stored.local_seo_review.skipped.length, 6);
});

test('if the review fails, the draft continues unchanged with a note for marketing', () => {
  const result = apply({ error: { message: 'timeout' } });
  assert.equal(result.article_html, draftHtml);
  assert.match(result.review_document_markdown, /did not run because the AI request failed/);
  assert.equal(JSON.parse(result.package_json).local_seo_review.status, 'FAILED');
});
