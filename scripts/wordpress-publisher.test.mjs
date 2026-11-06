import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const workflow = JSON.parse(fs.readFileSync(new URL('../n8n/15-publish-approved-article-to-wordpress.json', import.meta.url), 'utf8'));
const source = workflow.nodes.find((node) => node.name === 'Prepare WordPress Publication').parameters.jsCode;
const prepare = new Function('$json', source);
const row = (config) => ({
  article_id: 'article_test',
  practice_id: 'practice_test_001',
  publisher_type: 'WORDPRESS',
  publisher_config_reference: JSON.stringify(config),
  website_domain: 'https://public-dental.test',
  featured_image_source_url: 'https://apexparent.hostmanpowered.com/wp-content/uploads/test-featured.jpg',
  featured_image_alt_text: 'A dental team discussing care',
  doctor_name: 'Dr. Test',
  practice_name: 'Test Dental',
  publication_package_json: JSON.stringify({
    metadata: { h1: 'Test article', slug: 'test-article', meta_description: 'Test summary' },
    article_html: '<h1>Test article</h1><p>Schedule at {{APPOINTMENT_URL}}</p>',
  }),
});

test('WordPress API uses explicit editing-site URL, while links use the public site', () => {
  const result = prepare(row({ credential_name: 'Wordpress account', wordpress_base_url: 'https://apexparent.hostmanpowered.com/test001/' }))[0].json;
  assert.equal(result.wordpress_api_url, 'https://apexparent.hostmanpowered.com/test001/wp-json/wp/v2');
  assert.match(result.content, /https:\/\/public-dental\.test/);
  assert.doesNotMatch(result.wordpress_api_url, /public-dental/);
});

test('automatic publication rejects an unverified practice even with a WordPress URL', () => {
  const candidate = row({ credential_name: 'Wordpress account', wordpress_base_url: 'https://apexparent.hostmanpowered.com/test001/' });
  candidate.practice_id = 'practice_other';
  assert.throws(() => prepare(candidate), /VERIFIED practice-to-WordPress mapping/);
});

test('publication fails closed without a separate WordPress subsite URL', () => {
  assert.throws(() => prepare(row({ credential_name: 'Wordpress account' })), /WordPress multisite subsite base URL/);
});

const verifiedConfig = { credential_name: 'Wordpress account', wordpress_base_url: 'https://apexparent.hostmanpowered.com/test001/' };

test('a campaign topic WordPress slug overrides the writer-recommended slug', () => {
  const candidate = { ...row(verifiedConfig), topic_wordpress_slug: 'why-brushing-before-bed-matters' };
  const result = prepare(candidate)[0].json;
  assert.equal(result.slug, 'why-brushing-before-bed-matters');
  assert.equal(result.wordpress_body.slug, 'why-brushing-before-bed-matters');
  assert.equal(result.article_slug_base, 'why-brushing-before-bed-matters');
  assert.match(result.article_slug_collision, /^why-brushing-before-bed-matters-article-/);
});

test('without a topic slug the writer-recommended slug is still used', () => {
  const result = prepare(row(verifiedConfig))[0].json;
  assert.equal(result.slug, 'test-article');
});

test('an invalid topic slug fails closed instead of publishing an unexpected URL', () => {
  assert.throws(() => prepare({ ...row(verifiedConfig), topic_wordpress_slug: 'Bad Slug!' }), /WordPress URL slug/);
});

test('the publisher loads the topic slug from the campaign topic', () => {
  const query = workflow.nodes.find((node) => node.name === 'Load Approved WordPress Article').parameters.query
    ?? workflow.nodes.find((node) => node.name === 'Load Approved WordPress Article').parameters.sqlQuery;
  assert.match(query, /'\$\.wordpress_slug'\) AS topic_wordpress_slug/);
});

test('the doctor bio sits in the left sidebar directly under the FAQ, not below the article', () => {
  const layoutSource = workflow.nodes.find((node) => node.name === 'Set Featured Image and Prepare Post').parameters.jsCode;
  const candidate = row(verifiedConfig);
  candidate.photo_source_url = 'https://public-dental.test/doctor.jpg';
  candidate.profile_url = 'https://public-dental.test/about';
  candidate.publication_package_json = JSON.stringify({
    metadata: { h1: 'Test article', slug: 'test-article', meta_description: 'Test summary' },
    author_bio: 'Dr. Test is a placeholder dentist used only in this automated layout test.',
    article_html: '<h1>Test article</h1><p>Body</p><section class="aac-article-faq"><h2>FAQ</h2><p>Answer</p></section><p>Schedule at {{APPOINTMENT_URL}}</p>',
  });
  const prepared = prepare(candidate)[0].json;
  const $ = () => ({ first: () => ({ json: prepared }) });
  const content = new Function('$json', '$', layoutSource)({ id: 7, source_url: 'https://apexparent.hostmanpowered.com/wp-content/uploads/test.jpg' }, $)[0].json.content;
  const sidebar = content.match(/<aside class="aac-article-sidebar"[\s\S]*<\/aside>/)?.[0] || '';
  assert.ok(sidebar.indexOf('aac-article-faq') > -1 && sidebar.indexOf('aac-author-bio-card') > sidebar.indexOf('aac-article-faq'));
  assert.equal(content.match(/About Dr\. Test/g).length, 1);
  assert.ok(content.trim().endsWith('</aside></div>'));
  assert.match(sidebar, /View full bio/);
  assert.match(sidebar, /href="https:\/\/public-dental\.test\/contact-us\/" target="_blank" rel="noopener">Book appointment/);
  assert.match(content, /\.aac-article-sidebar\{grid-column:1!important/);
});

const layoutSource = workflow.nodes.find((node) => node.name === 'Set Featured Image and Prepare Post').parameters.jsCode;
const chooseSource = workflow.nodes.find((node) => node.name === 'Choose WordPress Create or Update').parameters.jsCode;
const faqList = [
  ['Why do my gums bleed when I brush?', 'Plaque buildup is the most common cause.'],
  ['How do I stop bleeding gums?', 'Brush gently twice a day.'],
  ['Is bleeding normal?', 'It is common but not normal.'],
  ['Can [sc name="practice_name"][/sc] help?', 'Yes, our team can check your gums.'],
];
const publishLayout = (faqHtml, extra = {}) => {
  const candidate = { ...row(verifiedConfig), photo_source_url: 'https://public-dental.test/doctor.jpg', wordpress_publish_date: '2026-10-16', ...extra };
  candidate.publication_package_json = JSON.stringify({
    metadata: { h1: 'Why Do My Gums Bleed When I Brush My Teeth?', slug: 'test-article', meta_description: 'Test summary' },
    author_bio: 'Dr. Test is a placeholder dentist used only in this automated layout test.',
    article_html: '<h1>Why Do My Gums Bleed When I Brush My Teeth?</h1>\n<p><strong>By Dr. Test, DDS</strong></p>\n<h2>Why Do Gums Bleed?</h2><p>See the <a href="https://www.ada.org/">ADA</a>.</p>' + faqHtml + '<p>Closing call to action at {{APPOINTMENT_URL}}</p>',
  });
  const prepared = prepare(candidate)[0].json;
  const chosen = new Function('$input', '$', chooseSource)({ all: () => [] }, () => ({ first: () => ({ json: prepared }) }))[0].json;
  return new Function('$json', '$', layoutSource)({ id: 7, source_url: 'https://apexparent.hostmanpowered.com/wp-content/uploads/test.jpg' }, () => ({ first: () => ({ json: chosen }) }))[0].json.content;
};
const faqMarkup = (items) => items.map(([question, answer]) => '<h3>' + question + '</h3><p>' + answer + '</p>').join('');

test('the dark title banner shows the title, byline, and date with a round featured image', () => {
  const content = publishLayout('<section class="aac-article-faq"><h2>Frequently Asked Questions</h2>' + faqMarkup(faqList) + '</section>');
  const hero = content.match(/<div class="aac-article-hero"[\s\S]*?<\/div><\/div><\/div>/)?.[0] || '';
  assert.match(hero, /background-color:var\(--e-global-color-secondary, #231f20\)/);
  assert.match(hero, /<h1 class="aac-article-title"[^>]*>Why Do My Gums Bleed When I Brush My Teeth\?<\/h1>/);
  assert.match(hero, /class="aac-article-byline"[^>]*>By Dr\. Test, DDS</);
  assert.match(hero, /class="aac-article-date"[^>]*>October 16, 2026</);
  assert.match(hero, /border-radius:50%/);
  assert.equal(content.match(/By Dr\. Test, DDS/g).length, 1);
  assert.match(content, /h1\.entry-title:not\(\.aac-article-title\)[^{]*\{display:none!important\}/);
});

test('FAQ 1 becomes the answer box and FAQs 2 to 4 become collapsible sidebar questions', () => {
  const content = publishLayout('<section class="aac-article-faq"><h2>Frequently Asked Questions</h2>' + faqMarkup(faqList) + '</section>');
  const main = content.match(/<div class="aac-article-main"[\s\S]*?(?=<aside)/)?.[0] || '';
  const sidebar = content.match(/<aside class="aac-article-sidebar"[\s\S]*<\/aside>/)?.[0] || '';
  assert.match(main, /^<div class="aac-article-main"[^>]*><section class="aac-featured-answer"[^>]*><h2[^>]*>Why do my gums bleed when I brush\?<\/h2>/);
  assert.equal((sidebar.match(/<details class="aac-faq-item"/g) || []).length, 3);
  assert.ok(sidebar.indexOf('aac-article-faq-box') < sidebar.indexOf('aac-author-bio-card'));
  assert.match(sidebar, /<summary[^>]*>Can \[sc name="practice_name"\]\[\/sc\] help\?<\/summary>/);
  assert.doesNotMatch(main, /Frequently Asked Questions/);
});

test('every article link opens in a new tab', () => {
  const content = publishLayout('');
  assert.match(content, /<a href="https:\/\/www\.ada\.org\/" target="_blank" rel="noopener">ADA<\/a>/);
  const links = content.match(/<a\b[^>]*\bhref=[^>]*>/g) || [];
  assert.ok(links.length >= 2);
  for (const link of links) assert.match(link, /target="_blank"/);
});

test('an older article with an FAQ heading but no FAQ wrapper is still formatted, and its closing text stays in the article', () => {
  const content = publishLayout('<h2>Frequently Asked Questions</h2>' + faqMarkup(faqList));
  const main = content.match(/<div class="aac-article-main"[\s\S]*?(?=<aside)/)?.[0] || '';
  assert.match(main, /aac-featured-answer/);
  assert.match(main, /Closing call to action at https:\/\/public-dental\.test/);
  assert.equal((content.match(/<details class="aac-faq-item"/g) || []).length, 3);
});

test('updating an existing post keeps its original date in the banner', () => {
  const content = publishLayout('', { wordpress_publish_date: '' });
  assert.match(content, /class="aac-article-date"/);
  const chosen = new Function('$input', '$', chooseSource)(
    { all: () => [{ json: { id: 55, slug: 'test-article-article-article-test', date: '2026-09-01T12:00:00' } }] },
    () => ({ first: () => ({ json: { ...prepare(row(verifiedConfig))[0].json } }) }),
  )[0].json;
  assert.equal(chosen.existing_post_date, '2026-09-01T12:00:00');
});

test('the article writers are told to produce the 4-item FAQ block the publisher formats', () => {
  const generation = JSON.parse(fs.readFileSync(new URL('../n8n/06-generate-article.json', import.meta.url), 'utf8'))
    .nodes.find((node) => node.name === 'Prepare Article Generation Request').parameters.jsCode;
  assert.match(generation, /EXACTLY 4 items/);
  assert.match(generation, /<section class=\\"aac-article-faq\\">/);
  for (const file of ['10-revise-article-from-doctor-feedback.json', '20-revise-article-from-marketing-feedback.json']) {
    const source = fs.readFileSync(new URL('../n8n/' + file, import.meta.url), 'utf8');
    assert.match(source, /exactly 4/);
  }
});

test('a re-send updates the article\'s existing WordPress post, never a new one, even if its slug changed in WordPress', () => {
  const context = { ...prepare(row(verifiedConfig))[0].json, prior_wordpress_post_id: '55' };
  const choose = (posts) => new Function('$input', '$', chooseSource)({ all: () => posts.map((json) => ({ json })) }, () => ({ first: () => ({ json: context }) }))[0].json;
  const found = choose([{ id: 55, slug: 'test-article', date: '2026-09-01T12:00:00' }]);
  assert.equal(found.existing_post_id, '55');
  assert.match(found.wordpress_publish_url, /\/posts\/55$/);
  assert.equal(found.wordpress_body.slug, 'test-article');
  const renamed = choose([]);
  assert.equal(renamed.existing_post_id, '55');
  assert.match(renamed.wordpress_publish_url, /\/posts\/55$/);
  assert.equal('slug' in renamed.wordpress_body, false, 'keeps whatever web address the post has in WordPress');
});

test('the blog uses the practice site\'s own Elementor global colors, with the standard colors only as a fallback', () => {
  const content = publishLayout('<section class="aac-article-faq"><h2>Frequently Asked Questions</h2>' + faqMarkup(faqList) + '</section>', {
    photo_source_url: 'https://public-dental.test/doctor.jpg', profile_url: 'https://public-dental.test/about' });
  assert.match(content, /class="aac-featured-answer"[^>]*border-top:3px solid var\(--e-global-color-primary, #ad0052\)/);
  assert.match(content, /aac-author-bio-book"[^>]*background-color:var\(--e-global-color-primary, #ad0052\)/);
  assert.match(content, /aac-author-bio-profile"[^>]*background-color:var\(--e-global-color-text, #231f20\)/);
  assert.doesNotMatch(content.replace(/var\(--e-global-color-[a-z]+, #[0-9a-f]{6}\)/gi, ''), /#ad0052|#231f20/i, 'no fixed practice colors outside a fallback');
});

test('an older article whose FAQ uses collapsible <details> items still gets the answer box and sidebar questions', () => {
  const details = faqList.map(([question, answer]) => '<details><summary><strong>' + question + '</strong></summary><p>' + answer + '</p></details>').join('');
  const content = publishLayout('<h2>Frequently Asked Questions</h2>' + details);
  const main = content.match(/<div class="aac-article-main"[\s\S]*?(?=<aside)/)?.[0] || '';
  assert.match(main, /^<div class="aac-article-main"[^>]*><section class="aac-featured-answer"[^>]*><h2[^>]*>Why do my gums bleed when I brush\?<\/h2>/);
  assert.equal((content.match(/<details class="aac-faq-item"/g) || []).length, 3);
  assert.match(main, /Closing call to action at https:\/\/public-dental\.test/, 'the closing call to action after the FAQ stays in the article');
  assert.doesNotMatch(main, /Frequently Asked Questions/);
});

test('"Book appointment" opens the site\'s NexHealth scheduling pop-up when the site has one', () => {
  const candidate = { ...row(verifiedConfig), photo_source_url: 'https://public-dental.test/doctor.jpg', wordpress_publish_date: '2026-10-16' };
  candidate.publication_package_json = JSON.stringify({
    metadata: { h1: 'Test article', slug: 'test-article', meta_description: 'Test summary' },
    author_bio: 'Dr. Test is a placeholder dentist used only in this automated layout test.',
    article_html: '<h1>Test article</h1><p>Body</p><p>Schedule at {{APPOINTMENT_URL}}</p>',
  });
  const prepared = prepare(candidate)[0].json;
  const chosen = new Function('$input', '$', chooseSource)({ all: () => [] }, () => ({ first: () => ({ json: prepared }) }))[0].json;
  const run = (popups) => new Function('$json', '$', layoutSource)(
    { id: 7, source_url: 'https://apexparent.hostmanpowered.com/wp-content/uploads/test.jpg' },
    (name) => name === 'Find Scheduling Popup'
      ? { all: () => popups.map((json) => ({ json })) }
      : { first: () => ({ json: chosen }) },
  )[0].json.content;
  const withPopup = run([{ id: 9100, title: { rendered: 'Other popup' }, status: 'publish' }, { id: 7500, title: { rendered: 'NexHealth' }, status: 'publish' }]);
  const book = withPopup.match(/<a class="aac-author-bio-button aac-author-bio-book"[^>]*>/)[0];
  const settings = decodeURIComponent(book.match(/settings%3D([^"]+)"/)[1]);
  assert.deepEqual(JSON.parse(Buffer.from(settings, 'base64').toString()), { id: '7500', toggle: false });
  assert.match(book, /href="#elementor-action%3Aaction%3Dpopup%3Aopen%26settings%3D/);
  assert.doesNotMatch(book, /target="_blank"/, 'the pop-up opens on the page');
  // No NexHealth popup, or the lookup failed: the button goes to the practice's Contact Us page.
  for (const popups of [[], [{ error: 'rest_no_route' }]]) {
    assert.match(run(popups), /<a class="aac-author-bio-button aac-author-bio-book"[^>]*href="https:\/\/public-dental\.test\/contact-us\/" target="_blank"/);
  }
  // The article's own closing call to action keeps the practice website link.
  assert.match(withPopup, /Schedule at https:\/\/public-dental\.test</);
  const lookup = workflow.nodes.find((node) => node.name === 'Find Scheduling Popup');
  assert.equal(lookup.onError, 'continueRegularOutput');
  assert.match(lookup.parameters.url, /\/elementor_library\?search=NexHealth/);
  assert.equal(workflow.connections['Choose WordPress Create or Update'].main[0][0].node, 'Find Scheduling Popup');
  assert.equal(workflow.connections['Find Scheduling Popup'].main[0][0].node, 'Download Featured Image');
});
