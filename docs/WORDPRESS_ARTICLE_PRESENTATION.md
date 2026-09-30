# WordPress article presentation

This note records the September 24, 2026 test-pilot work on article bylines,
doctor profiles, featured images, FAQs, and rendered WordPress output. It does
not authorize publishing outside the existing test/pilot route or running the
separate Headless Hostman static-site release.

## Doctor profile source

Do not use the generic Shortcoder `doctor_01` or `doctor_02` fields to identify
the interviewed dentist. The article's doctor identity continues to come from
the campaign/interview record.

A read-only audit searched the mapped WordPress editing subsites for the 109
active full- and part-time general dentists in the authoritative workbook. A
likely profile page was found for 99 dentists and both a page and image result
for 98, but only 46 of 57 subsites covered every eligible dentist. Results were
also sometimes ambiguous, returned a profile on another cloned subsite, or
contained theme output before the expected response. Live per-publication
discovery is therefore not reliable enough for unattended publishing.

The smallest maintainable workbook addition is one `Doctor Profiles` tab with
one row per dentist and these columns:

| Column | Purpose |
| --- | --- |
| `Work Email` | Stable join to the existing Doctor Census row; required and unique |
| `Doctor Name` | Human-readable verification value |
| `Credentials` | Public byline suffix such as DDS or DMD |
| `Location Code` | Prevents a valid profile from being used on the wrong practice site |
| `Profile URL` | Canonical public practice profile URL |
| `Photo Source URL` | Direct HTTPS URL to the approved headshot file |
| `Short Bio` | Approved short profile copy; no live-page scraping at publication time |
| `Source` | Where the approved values came from |
| `Verified At` | Date of human verification |
| `Active` | Explicit publishing switch |
| `Notes` | Optional maintenance note; never secrets or patient information |

The tab now exists in the shared workbook with one clearly marked, inactive
sample row and one active TEST-1 row for Jake Dold. Jake's row is explicitly
marked as a test identity, not a dentist profile, and must not be used for a
real-practice article. A profile page link and headshot link are not enough for reliable
unattended copy: page scraping can fail or change without notice. Store a short
approved bio directly in the row, and mark the row active only after the profile
URL, direct photo URL, credentials, and bio have been checked.

The sheet is an administrative input, not the workflow state store. A guarded
sync validates HTTPS URLs and the location join, then upserts the values into
BigQuery `doctor_profiles`. The manual inactive workflow
`AAC - 21 - Sync Doctor Profiles from Workbook` is currently restricted to the
single active TEST-1 row and completed successfully on September 24, 2026.
BigQuery remains the system of record. Until a
verified row exists, the publisher uses only the known interviewed dentist's
name in a short fallback About section; it does not invent a bio, photo, or
profile link.

## Required article structure

Generation and both revision paths now require:

1. one byline immediately after the title, using the verified interviewed
   dentist name and credentials;
2. one `About Dr. [Name]` section near the bottom, populated only from verified
   profile fields when available;
3. a useful FAQ as the final public section, with three to six topic-specific
   questions and concise answers.

Workflow validators reject missing or duplicate bylines/profile sections,
FAQs outside the required range, and any heading after the FAQ. The WordPress
publisher also normalizes these elements as a deterministic final guard.

## Featured-image contract

Each of the three campaign topics must be paired with a real, preapproved image
record before invitations are created. The image is stored once in a stable,
Apex-controlled central asset location. Campaign setup records its central
HTTPS source URL, alt text, source type, and rights/source reference on the
matching BigQuery `campaign_topics` row.

The doctor selects a `topic_id`, so no later image choice or AI inference is
needed. At publication time, n8n downloads that exact source file, uploads it
through the target subsite's authenticated `/wp-json/wp/v2/media` endpoint,
then uses the returned target-site media ID as `featured_media`. Because the
current practice theme does not display `featured_media` on article pages, the
publisher also places the returned target-site URL once immediately after the
byline. The user uploads/configures the campaign image once; subsite copies are
created automatically only for practices that actually publish the topic.

Generated-image prompts must avoid logos, text overlays, patient-identifying
details, and the likeness of a real dentist unless an approved reference and
release are recorded. `OPENAI_GENERATED` records should retain the final prompt,
model, generation time, and the organization's approved rights basis. This is
an operational provenance record, not a substitute for legal review.

For the smallest V1 operational footprint, use the Apex Parent WordPress Media
Library at
`https://apexparent.hostmanpowered.com/wp-admin/upload.php?mlo-category=all-files`
as the central campaign-asset library. Upload each topic image there once and
paste its direct file URL into campaign setup. The campaign value must be the
actual file URL under
`https://apexparent.hostmanpowered.com/wp-content/uploads/`, not the Media
Library admin-page URL. The same publisher design can use object storage later.
Google Drive sharing URLs are not recommended as the binary source because they
can require redirects or interactive access.

Before uploading, the publisher searches the target site for the deterministic
media slug `aac-<topic_id>` and reuses the existing attachment when present. A
retry after a successful upload therefore cannot create another copy of the
same campaign image.

The designated central library is the Apex Parent Media Library above. The
pilot asset is versioned at
`assets/featured-images/dental-cleaning-frequency-pilot.png` and stored once in
the central library at
`https://apexparent.hostmanpowered.com/wp-content/uploads/2026/09/dental-cleaning-frequency-pilot.png`.
The inactive, exact-scope workflow `n8n/22-configure-pilot-topic-image.json`
records that URL, alt text, source type, and rights reference on the existing
pilot topic in BigQuery. The publisher then copies the binary into the target
subsite automatically; campaign operators do not upload it again per site.

## SEO metadata contract

The article package includes an H1, SEO title, lowercase hyphenated slug, meta
description, focus keyphrase, and primary search intent. The WordPress adapter
always sets the post title, slug, excerpt, and featured media. On the current
site, Yoast uses those fields to produce the canonical URL, description, and
social image.

The custom Yoast helper in `wordpress/apex-article-seo-rest.php` is intentionally
parked for now. The publisher continues to populate WordPress core title, slug,
excerpt, and featured-media fields; it omits protected Yoast fields unless that
helper is separately reviewed and enabled later.

## Rendered QA

The existing pilot post was inspected in the actual WordPress front end, not
only in generated HTML. The baseline rendered clean headings and a six-item
FAQ, but its byline and About section contained only the earlier test fallback,
and it had no featured image. The inactive, exact-scope QA harness
`n8n/23-run-exact-pilot-wordpress-qa.json` can refresh only article
`article_6296aabf938f492eafd5a2b010b3f8c9` / WordPress post `9988` through the
revised publisher. Two confirmed runs completed successfully on September 24,
2026. The first copied the central asset into the target subsite and updated the
existing post; the second reused the same deterministic attachment rather than
uploading another copy. The target media search returned exactly one matching
attachment, ID `9992`, at
`https://apexparent.hostmanpowered.com/dfw-03/wp-content/uploads/sites/2/2026/09/aac-campaign-test-202609-aac-prestonwood-pilot-2026-09-23-topic-3.png`.

Rendered QA confirmed exactly one byline, one topic image with useful alt text,
one About section, and the existing six-question FAQ. The H1/H2/H3 hierarchy,
paragraph spacing, image width, and transition from About to FAQ rendered
cleanly on the live WordPress page. The Jake TEST-1 workbook row intentionally
does not contain a real dentist headshot, profile URL, or approved bio, so the
About section correctly remains the deterministic fallback rather than
inventing those details. The canonical URL stayed unchanged and the topic image
became the Open Graph image. No email, other practice, or Headless Hostman
release was triggered.

The legacy pilot package predates the required SEO metadata fields. Its QA path
therefore supplies an exact-article-only title, existing slug, bounded excerpt,
SEO title, and focus keyphrase. Normal publishing still fails closed when a new
approved package lacks those fields. The current Yoast meta description remains
the previously stored description because the optional Yoast REST helper is
still parked; WordPress core title, slug, excerpt, and featured media were
updated automatically.
