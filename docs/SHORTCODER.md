# WordPress Shortcoder fields for article publishing

The WordPress editing sites use Shortcoder. The names below come from the September 23, 2026 Shortcoder list supplied by Apex; they are not interchangeable with the older `{{...}}` placeholders in earlier article drafts.

| Purpose | Shortcoder tag |
| --- | --- |
| Practice name | `[sc name="practice_name"][/sc]` |
| Phone | `[sc name="practice_phone_number"][/sc]` |
| Address | `[sc name="practice_address"][/sc]` |
| City | `[sc name="practice_city"][/sc]` |
| Email | `[sc name="practice_email"][/sc]` |

The supplied list also includes `[sc name="practice_online_scheduling_booking_header"][/sc]`, but that is a booking *header*, not a verified appointment URL. Do not place it in a link or insert it automatically until its output and intended placement are checked on each WordPress subsite. The `doctor_01` and `doctor_02` tags are generic site fields, not a reliable identity for the interviewed doctor. Use the verified interview context for doctor attribution.

The article-generation and revision instructions live in [`prompts/`](../prompts/README.md). The WordPress publisher preserves Shortcoder tags in post content and converts an older `{{PRACTICE_NAME}}` token to the practice-name shortcode for test-site compatibility. Confirm that each target subsite has the relevant Shortcoder entries before expanding publishing beyond TEST-1.

Shortcoder tags resolve on the WordPress editing site. The separate Headless Hausman static-site release is manual and may need its own rendering check; a WordPress post alone does not update the live static site.
