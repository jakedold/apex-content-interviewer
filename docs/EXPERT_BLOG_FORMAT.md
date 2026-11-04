# Expert blog page format

This is the standard layout that the WordPress publisher (`n8n/15-publish-approved-article-to-wordpress.json`, node **Set Featured Image and Prepare Post**) builds for every expert article. It automates Brenna's November 2026 formatting notes, so marketing no longer rebuilds each post by hand in Elementor.

## What the publisher builds

1. **Title banner.** A full-width dark band (`#231f20`) with the featured image cropped to a circle on the left. On the right are the title (white, bold), the byline ("By Dr. Name, DDS", white, bold) and the date. The date is the campaign topic's WordPress publish date, or the existing post's date when a post is updated, or today. The theme's own post title is hidden so the title appears only once.
2. **Featured answer box.** FAQ 1 appears at the top of the article column: light gray background, burgundy (`#ad0052`) line across the top, the question as a heading with an underline rule, then the direct answer.
3. **Left sidebar.** An "FAQ" box with FAQs 2 to 4 as collapsible questions. The doctor bio card sits directly under it, 24px lower. The card stacks a round photo with a burgundy border, "About Dr. Name", the bio, and full-width **View full bio** (black) and **Book appointment** (burgundy) buttons.
4. **Article body.** Links use the burgundy accent and open in a new tab. Lists have space before the next paragraph. Nothing sits between the article and the footer.
5. **Smaller screens.** Below 1100px wide, the sidebar moves under the article so readers reach the article first. On phones, the banner stacks the image above the title.

## What the article writer produces

The generation and revision prompts in `prompts/` require:

- an H1 and most H2 headings phrased as natural patient questions;
- exactly 4 FAQs at the end, wrapped in `<section class="aac-article-faq">` with `<h3>` questions and `<p>` answers, FAQ 1 being the most important question answered in 2 to 4 sentences;
- the practice name field in the opening and the closing call to action, and `[hh_short name="practice_city_and_state"]` once where natural; no website fields in the H1.

Articles written before this format that have an "FAQ" or "Frequently Asked Questions" H2 followed by H3 questions are formatted the same way.

## Automated local SEO review

Right after the first draft is written, and before the doctor sees it, workflow 06 runs the draft through the rules from Brenna's "AEO/SEO Page Updates" GPT (`prompts/local-seo-review-prompt.md`). It can rewrite the H1, H2 headings and FAQ questions, and add short practice or location references to paragraphs and FAQ answers. Safety checks skip any suggestion that would change existing medical wording, add or change links or HTML, use a website field that is not approved, or put a field in the title. Applied changes are listed at the end of the review document under "Local SEO Updates (automated)". If the review fails, the draft continues unchanged with a note asking marketing to check locations by hand.

## Still done by people

- Running the "SEO/GEO Article Analysis" custom GPT for extra suggestions (optional; the writer now follows the same heading and FAQ rules, and the "AEO/SEO Page Updates" rules run automatically).
- Clicking through links to confirm they work and match their link text.
- Checking the post on desktop and phone after publishing.

## Open items to confirm on a test post

- That the theme's own title is hidden on each practice theme (`h1.entry-title`, `.page-header h1`, `.wp-block-post-title`, and the Elementor post-title widget are covered).
- The byline uses the verified interview doctor name rather than the generic `doctor_01` Shortcoder field (see `docs/SHORTCODER.md`).
- That `[hh_short name="practice_city_and_state"]` renders on each practice site, including TEST001.
