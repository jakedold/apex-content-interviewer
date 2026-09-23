# n8n workflow exports

This directory stores version-controlled exports of the discrete n8n workflows used by the browser interview vertical slice.

The deployed n8n instance remains the runtime source for credentials and environment-specific configuration. Exports must never contain credentials or secrets.

Version-controlled workflow exports:

- `01-launch-campaign.json` — private administrator form for one campaign, three topics, and a list of doctors
- `01-roster-selection-preview.json` — inactive, selection-only staging form that reads the two Google Sheets, preselects eligible locations and dentists, and returns a preview without creating a campaign or sending messages
- `01-test-entries-preview.json` — separate inactive form for temporary test practices and email recipients; it validates and previews entries without saving them or sending anything
- `02-dispatch-campaign-invitations.json` — scheduled invitation delivery through the private message router
- `02-create-topic-interview-links.json`
- `03-validate-interview-link.json`
- `04-start-voice-interview.json`
- `05-interview-completed.json`
- `06-generate-article.json`
- `07-create-doctor-review-link.json`
- `08-validate-article-review-link.json`
- `09-record-doctor-review-response.json`
- `10-revise-article-from-doctor-feedback.json`
- `11-auto-approve-expired-doctor-reviews.json`
- `12-route-to-marketing-review.json`
- `13-validate-marketing-review-link.json`
- `14-record-marketing-review-response.json`
- `15-publish-approved-article-to-wordpress.json`
- `16-send-doctor-message.json`
- `17-doctor-review-reminders.json`
- `18-send-marketing-review-invitation.json`

Campaign launch is a separate step from publishing. The administrator enters a
campaign name, month, exact location/practice name, matching HTTPS website URL,
three distinct topics, and doctors as `Name,email` lines. The form validates
these inputs against one active practice profile, rejects a duplicate campaign
name/month, and blocks silent reassignment or duplication of existing doctors.
Each campaign currently targets one location and one website. The form records
the campaign and its doctors in BigQuery. The
invitation dispatcher checks for READY doctors every five minutes and sends
one email containing three secure interview links to each doctor. Each link
expires after 30 days. Failed deliveries can be retried, while successful
deliveries are not repeated. The older `02-create-topic-interview-links.json`
is a legacy test workflow and should remain inactive.

The live launch form currently remains inactive. Its first version accepted
only a practice profile ID. The revised export includes explicit location and
website fields plus mapping validation; it is not yet installed in live n8n.
The next launch-form revision must read two authoritative Google Sheets instead
of `apex-empower.empower.role`, which currently has no usable rows:

- [Master Location List](https://docs.google.com/spreadsheets/d/1fAP9gu66_rwZ9xUCjmxdql-FznlG-PQvepVaH6ThmnE/edit), `Master List` tab: location code/name/type are columns
  A–C (header row 4); public website is column N. Include only `GD` practices
  with a public website; exclude `-E`, `-O`, `-P`, test locations, support
  offices, and the not-yet-launched `DFW-24` and `DFW-25` locations.
- [Employee Census](https://docs.google.com/spreadsheets/d/1M0arM4jnZzalySGUKq60Hp1yhTDz2RQTXqMeOWfaOUA/edit), `Sheet1` tab: name, primary location, department, and
  employment type are columns A–D (header row 2); work email is column I.
  Include only `General Dentist` employees marked `Full-Time` or `Part-Time`.
  Exclude contractors, vendors, DFW-Test, and any doctor whose primary location
  is unavailable. Join by the location code in parentheses, not by email
  domain or website, because several locations share a domain.

The exact columns and privacy-safe validation rules are documented here and in
`../scripts/campaign-roster.mjs`. Do not commit a roster
snapshot containing dentist names or email addresses. As checked on 2026-09-22,
the sheets contain 60 general-dentist locations and 109 full- or part-time
general dentists before launch-readiness gating. Two new locations (`DFW-24`,
`DFW-25`) are not launched and have blank public website cells, leaving 58
selectable locations and 106 selectable dentists. Keep those two locations and
their three dentists out of campaigns even if a URL is filled in, until the
sites are launched. On 2026-09-22, the existing `Google Sheets account`
connection successfully read bounded ranges from both files in the inactive
`AAC - Roster Sheet Access Check (Inactive)` workflow. The check showed n8n's
`row_number` is relative to the selected A1 range, so separate column reads
must use the same starting row before joining by `row_number`. The existing
live launch form is still inactive. The sheet-driven selection preview is
installed in n8n as an inactive, non-sending staging workflow.

The staging preview export intentionally has no credential bindings or write
nodes. After import, attach the existing `Google Sheets account` credential to
its four read nodes and a dedicated Basic Auth credential to its Form Trigger
before using its test URL. It reads only the relevant columns, preserves row
alignment by the relative `row_number`, and never commits its selection to
BigQuery. Keep the original campaign launcher and invitation dispatcher
inactive while validating this preview. Its n8n workflow is
`AAC - Roster-Driven Campaign Selection Preview`.

Use the separate test-entry preview when adding non-roster practices or email
addresses for a trial. Enter one practice per line as `Practice name | public
website URL` (URL optional), and one recipient per line as `email | practice
name` (practice name optional when only one practice is entered). These test
entries are not added to the authoritative Google Sheets or BigQuery, and
cannot be mixed into the real-dentist selection preview. The installed n8n
workflow is `AAC - Test Practices and Emails Preview` and remains inactive.
The form is a temporary validation surface, not a saved test roster or a live
campaign option. Neither preview contains a mail, campaign-write, WordPress,
or static-release action.

Persistent test-only entries live in two separate n8n Data Tables in the
Personal project. Use **Add Row** there to maintain them; do not put test
entries in the authoritative census or location sheets:

- `AAC Test Practices` (`vyWqiwFpRvYDGnW6`): `practice_name`,
  `public_website_url`, `wordpress_site_url`. The WordPress URL is the editing
  subsite, not the public static URL.
- `AAC Test Emails` (`UVcspQQJPdgtgf9q`): `email`, `practice_name`. Match
  `practice_name` exactly to a row in the test-practices table.

These tables are not connected to any email-sending or campaign workflow.
The test-entry preview validates temporary form input only; it does **not**
write to these tables. Review and add rows explicitly in the tables when they
should be kept for future testing.

Do not reactivate it for real campaigns until authoritative location/website
and doctor assignments are entered in BigQuery, the revised export is installed
and tested, and any doctors who work across multiple websites have an explicit
publishing-site choice. Keep the dedicated Basic Auth
credential attached to its Form Trigger; do not put that credential or the form
URL in this repository. The form starts campaigns; it does not publish articles
or trigger the Headless Hostman static-site release.

The article-generation workflow uses the approved prompt preserved at
`../prompts/article-generation-master-prompt.md`. It checks hourly at minute 5
for a completed interview that does not yet have an article. The manual trigger
remains available for diagnosis.

The article-revision workflow uses the dedicated prompt preserved at
`../prompts/article-revision-master-prompt.md`. It checks hourly at minute 10
for a doctor change request, revises the current package with the original
transcript and revision history in context, and inserts a new
`AI_DOCTOR_REVISION` version. The guarded review-link workflow issues the new
one-time link and sends it to the doctor at minute 20.

The doctor-review deadline workflow runs hourly, finds pending reviews whose
configured deadline has expired, marks the approval as automatic, expires the
active review link, advances the article to `DOCTOR_AUTO_APPROVED`, and records
an auditable `doctor.auto_approved` event. Its output identifies whether
marketing review or publishing is the next stage.

The marketing-review workflows route each doctor-approved article according
to its campaign setting. Required reviews receive a separate hashed one-time
link, and the marketing portal can either grant final approval or record a
written change request that blocks publishing. Campaigns that do not require
marketing approval advance directly to publishing.

The WordPress publishing workflow is the first publishing adapter. It only
loads approved articles for practices with an explicit WordPress publisher,
a real non-example domain, and a configured credential reference. It resolves
the approved package's publishing tokens, performs an idempotent slug-based
create or update, and records the external post ID, final URL, lifecycle state,
and audit event in BigQuery. The TEST001 practice has been configured for a
proof-of-concept WordPress post. Publishing remains manual; the Headless
Hostman static-site build and live release are separate, deferred steps.
The master-sheet URLs are the public static websites, not WordPress API
origins. They may identify the intended public location and supply public
links, but they must never be used to construct `/wp-json/wp/v2` endpoints.
Each practice needs a separate, explicitly verified WordPress multisite
subsite base URL and credential mapping before its publishing adapter is
enabled. For example, the TEST001 editing base is
`https://apexparent.hostmanpowered.com/test001/`; its static site release is a
different operation. No production location should be auto-published from a
public URL inferred from the master sheet.

The separate [AAC WordPress Site Map](https://docs.google.com/spreadsheets/d/1eP8YmH9vwCFXQ80_VjPXrGj6SGa1k3d2Ux00Xfcbw6A/edit)
is the current collection point for production editing-site URLs. It has one
row per currently eligible general-dentist location, keyed by the code from
the Master Location List. Fill only its `WordPress editing URL` column (and
optional notes); do not place credentials there. A dentist's primary-location
code in the Employee Census joins to that same location code. This sheet is
not yet synced into `practices.publisher_config_reference` or used by the
WordPress adapter, so filling it cannot trigger publishing or emails. Validate
each entered URL and credential association before any BigQuery sync.

The Phase 1K communication workflows centralize doctor-message routing and
deadline reminders. Email is the V1 delivery adapter, with preference-aware
fallback behavior and durable communication logging. SMS and Empower remain
explicit adapter slots for a later phase. The reminder workflow creates a
fresh hashed one-time review link for a single 48-hour reminder and delegates
delivery to the centralized router through a private n8n sub-workflow call;
there is no public message-sending webhook.

The review-link workflow sends initial and revised draft invitations through
that same private router. It checks for a successful invitation for the current
article version before creating another link, so a failed send can be retried
without repeating a successful one. Doctor approvals route to marketing review
at minute 25. The marketing invitation workflow checks at minute 30, rotates a
one-time marketing link, emails `jdold@apexdp.com`, and records successful
delivery so failures can be retried. WordPress publishing remains a separate,
manual adapter while the static-site publishing step is deferred.

Current browser endpoints:

- `POST /webhook/aac/interview/validate`
- `POST /webhook/aac/interview/start`
- `POST /webhook/aac/interview/complete`
- `POST /webhook/aac/review/validate`
- `POST /webhook/aac/review/respond`
- `POST /webhook/aac/marketing-review/validate`
- `POST /webhook/aac/marketing-review/respond`

The live workflows use credentials configured inside n8n. These exports intentionally omit credential bindings and secret values; reconnect the appropriate BigQuery and OpenAI credentials after importing them into another n8n instance.
