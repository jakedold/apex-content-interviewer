# Website fields (Headless Hostman shortcodes) for article publishing

Brenna's revised blog instructions (November 2026) allow only these three verified shortcodes in articles:

| Purpose | Shortcode |
| --- | --- |
| Practice name | `[hh_short name="practice_name"]` |
| Practice city and state | `[hh_short name="practice_city_and_state"]` |
| Practice phone number | `[hh_short name="practice_phone_number"]` |

Never use the older Shortcoder format (`[sc name="..."][/sc]`), and do not use other practice fields such as an address, email, or city on its own. The writer and revision prompts follow this, and workflow 15 converts any older `[sc name="practice_name"][/sc]`, `[sc name="practice_phone_number"][/sc]`, or `[sc name="practice_city_and_state"][/sc]` tag to the matching `[hh_short ...]` shortcode when an article is published or re-sent.

No website field may appear in an article's H1, because the H1 becomes the WordPress post title, which does not run shortcodes.

The supplied list also includes `[sc name="practice_online_scheduling_booking_header"][/sc]`, but that is a booking *header*, not a verified appointment URL. Do not place it in a link or insert it automatically until its output and intended placement are checked on each WordPress subsite. The `doctor_01` and `doctor_02` tags are generic site fields, not a reliable identity for the interviewed doctor. Use the verified interview context for doctor attribution.

The article-generation and revision instructions live in [`prompts/`](../prompts/README.md). The WordPress publisher preserves Shortcoder tags in post content and converts an older `{{PRACTICE_NAME}}` token to the practice-name shortcode for test-site compatibility. Confirm that each target subsite has the relevant Shortcoder entries before expanding publishing beyond TEST-1.

Shortcoder tags resolve on the WordPress editing site. The separate Headless Hausman static-site release is manual and may need its own rendering check; a WordPress post alone does not update the live static site.
