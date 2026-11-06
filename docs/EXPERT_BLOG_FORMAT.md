# Expert blog page format

This is the standard layout that the WordPress publisher (`n8n/15-publish-approved-article-to-wordpress.json`, node **Set Featured Image and Prepare Post**) builds for every expert article. It automates Brenna's November 2026 formatting notes, so marketing no longer rebuilds each post by hand in Elementor.

## What the publisher builds

1. **Title banner.** A full-width band in the site's Secondary color with the featured image cropped to a circle on the left. On the right are the title (white, bold), the byline ("By Dr. Name, DDS", white, bold) and the date. The date is the campaign topic's WordPress publish date, or the existing post's date when a post is updated, or today. The theme's own post title is hidden so the title appears only once.
2. **Featured answer box.** FAQ 1 appears at the top of the article column: light gray background, a line in the site's Primary color across the top, the question as a heading with an underline rule, then the direct answer.
3. **Left sidebar.** An "FAQ" box with FAQs 2 to 4 as collapsible questions. The doctor bio card sits directly under it, 24px lower. It matches the FAQ box (light gray, thin border, square corners) and the site's own doctor cards. The card stacks a 150px round photo with a border in the Primary color, "About Dr. Name", the bio, and full-width **View full bio** (Text color) and **Book appointment** (Primary color) buttons. **Book appointment** opens the site's own online scheduling pop-up, the Elementor popup named "NexHealth" that the header's **Schedule Today** button opens. The publisher looks it up on each site when it publishes. If a site has no such popup, or the lookup fails, the button goes to the practice's Contact Us page (`/contact-us/` on the public website).
4. **Article body.** Links use the Primary color and open in a new tab. Lists have space before the next paragraph. Nothing sits between the article and the footer.
5. **Smaller screens.** Below 1100px wide, the sidebar moves under the article so readers reach the article first. On phones, the banner stacks the image above the title.

## Site colors

Colors come from each practice site's Elementor Global Colors (**Edit with Elementor → Site Settings → Global Colors**), so each blog matches its own site without any per-practice setup:

| Blog element | Elementor global color |
| --- | --- |
| Title banner, rule under the featured question and the FAQ heading | Secondary |
| Featured answer top line, links, bio photo border, **Book appointment** button | Primary |
| **View full bio** button | Text |

The light gray boxes stay `#e9e9ec`. If a site has no Elementor global colors, the original colors from Brenna's mockup are used (`#231f20` banner, `#ad0052` accent). To change a blog's colors, change the site's global colors; existing posts pick up the change the next time the page loads.

## What the article writer produces

The generation and revision prompts in `prompts/` require:

- an H1 and most H2 headings phrased as natural patient questions;
- exactly 4 FAQs at the end, wrapped in `<section class="aac-article-faq">` with `<h3>` questions and `<p>` answers, FAQ 1 being the most important question answered in 2 to 4 sentences;
- the practice name field in the opening and the closing call to action, and `[hh_short name="practice_city_and_state"]` once where natural; no website fields in the H1.

Articles written before this format are formatted the same way when they have an "FAQ" or "Frequently Asked Questions" H2 followed by H3 questions or by collapsible `<details><summary>` questions. Re-sending such an article from the dashboard applies this layout without changing its approved wording.

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
