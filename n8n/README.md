# n8n workflow exports

This directory stores version-controlled exports of the discrete n8n workflows used by the browser interview vertical slice.

The deployed n8n instance remains the runtime source for credentials and environment-specific configuration. Exports must never contain credentials or secrets.

Version-controlled workflow exports:

- `01-launch-campaign.json` — private administrator form for one campaign, three topics, and a list of doctors
- `01-roster-selection-preview.json` — active, selection-only form that reads five privacy-limited ranges across four tabs of the shared workbook, separates test users from dentists, and returns a preview without creating a campaign or sending messages
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
- `19-prestonwood-wordpress-draft-pilot.json` — isolated manual credential/subsite check; creates only a fixed internal draft at Prestonwood and is not part of the article pipeline
- `20-revise-article-from-marketing-feedback.json` — marketing-requested revision; new immutable version and fresh marketing review without doctor reapproval

On September 23, 2026, the [inactive Prestonwood draft pilot](https://n8n.apexdentalautomation.com/workflow/x8P9o3fLDyDMxJ4s)
ran manually using the existing `Wordpress account` credential. Its
authenticated lookup found no earlier post with the fixed pilot slug. The
workflow then created and verified WordPress post `9987` as a **draft** on
`/dfw-03/`; the WordPress editor independently showed the same title, slug,
draft status, and `jdold` author. This internal integration text is not a
clinical article. The workflow has no email, BigQuery write, publication, or
Headless Hostman step and remains inactive. It does not remove the TEST001-only
guard from the production publisher or enable DFW-03 campaigns.

On September 23, 2026, the protected [test-only campaign launcher](https://n8n.apexdentalautomation.com/workflow/KvuBYWElqsvKx8lf)
was activated. Its [form](https://n8n.apexdentalautomation.com/form/aac-test-campaign-launch)
reads the shared workbook, offers only `Test User` entries at `TEST-1`, shows
the exact recipients before launch, and requires `SEND TEST INVITATIONS`.
The BigQuery write guards the test practice, WordPress editing URL, recipient
count, and existing doctor identities. The September pilot for
`jdold@apexdp.com` succeeded and its invitation reached `INVITED`.
The older free-entry launcher remains inactive. The live test-only launcher
still needs a credential-free JSON export checked in here; n8n is currently
its runtime source.

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

The older free-entry launch form remains inactive. Its first version accepted
only a practice profile ID. The revised export includes explicit location and
website fields plus mapping validation; it is not yet installed in live n8n.
The next launch-form revision must read the four tabs of the
[Authoritative Blog Article Distribution workbook](https://docs.google.com/spreadsheets/d/1M0arM4jnZzalySGUKq60Hp1yhTDz2RQTXqMeOWfaOUA/edit)
instead of `apex-empower.empower.role`, which currently has no usable rows:

- `Locations`: location code/name/type are columns A–C (header row 1);
  public website is column N. Include only `GD` practices
  with a public website; exclude `-E`, `-O`, `-P`, test locations, support
  offices, and the not-yet-launched `DFW-24` and `DFW-25` locations.
- `Doctor Census`: name, primary location, department, and
  employment type are columns A–D (header row 2); work email is column I.
  Include only `General Dentist` employees marked `Full-Time` or `Part-Time`.
  Exclude contractors, vendors, DFW-Test, and any doctor whose primary location
  is unavailable. Join by the location code in parentheses, not by email
  domain or website, because several locations share a domain.
- `Wordpress Sites`: location code/name/editing-site URL are columns A–C
  (header row 1). Join by code, reject duplicate or mismatched mappings,
  and normalize a scheme-less URL to HTTPS. Never substitute the public URL.
- `Test User`: email/name/location/WordPress URL are columns A–D (header row 1).
  This is a separate test-only audience; it must not be mixed with dentists.

The exact columns and privacy-safe validation rules are documented here and in
`../scripts/campaign-roster.mjs`. Do not commit a roster
snapshot containing dentist names or email addresses. `DFW-24` and `DFW-25`
remain excluded until their sites launch, even if URLs are populated. On
2026-09-22, the existing `Google Sheets account` connection successfully read
bounded ranges from the former files in the inactive
`AAC - Roster Sheet Access Check (Inactive)` workflow. The check showed n8n's
`row_number` is relative to the selected A1 range. The revised preview reads
all required columns together in each tab and joins by code, not row order. The existing
older free-entry launch form is still inactive. The sheet-driven selection preview is
installed in n8n as an active, non-sending workflow. Leaving exclusion boxes
unchecked includes all eligible locations or dentists; checking boxes omits
only those selections.

The staging preview export intentionally has no credential bindings or write
nodes. The active [Campaign Roster Selection (Preview Only)](https://n8n.apexdentalautomation.com/workflow/49aNWb8s90rbD0nA)
has the existing `Google Sheets account` connection on five read nodes. It
reads only Doctor Census columns A–D and I, not birthdays or personal email
addresses. Earlier imported drafts were archived.
The separate test-only launcher has dedicated Basic Auth and was exercised
end-to-end. This selection preview reads bounded ranges and never commits its
selection to BigQuery.
Keep the original campaign launcher inactive. The invitation dispatcher was
active in n8n on 2026-09-23, so creating READY campaign doctors could send
emails; the preview intentionally performs no BigQuery write.
The older [two-sheet preview](https://n8n.apexdentalautomation.com/workflow/dcenQwsnrc7ljMoR)
is superseded and remains inactive.

The `Test User` tab now owns persistent test-only entries. The former test-entry
preview and n8n Data Tables (`AAC Test Practices`, `AAC Test Emails`) are
superseded, inactive/disconnected references; do not add new test entries
there. Neither selection preview contains a mail, campaign-write, WordPress,
or static-release action. The unified preview has the new tab mapping and
dedicated Basic Auth. Its form execution still needs end-to-end confirmation
from an authenticated browser session before treating the UI as fully verified.

Do not reactivate it for real campaigns until authoritative location/website
and doctor assignments are entered in BigQuery, the revised export is installed
and tested, and any doctors who work across multiple websites have an explicit
publishing-site choice. Keep the dedicated Basic Auth
credential attached to its Form Trigger; do not put that credential or the form
URL in this repository. The form starts campaigns; it does not publish articles
or trigger the Headless Hostman static-site release.

The test-only article stages now hand off when the preceding stage finishes:
interview completion → first draft → doctor review invitation; doctor approval
→ marketing invitation; doctor change request → revised draft → new doctor
review invitation; marketing change request → revised draft → fresh marketing
review invitation; marketing approval → WordPress publication. The review
portal responds before the next stage runs. Invalid or expired decisions do
not launch another stage. Each sub-workflow selects the exact article or
interview ID and guards `practice_test_001` before doing work.
The old hourly stage-polling nodes in workflows 06, 07, 10, 12, and 18 are
deactivated. These sub-workflows show **Inactive** in n8n because their entry
point is a parent workflow call, not a webhook or schedule. Manual test
triggers remain for diagnosis. The generation and revision prompts remain
versioned in `../prompts/` and use the Shortcoder guidance in
`../docs/SHORTCODER.md`.

The doctor-review deadline workflow runs hourly, finds pending reviews whose
configured deadline has expired, marks the approval as automatic, expires the
active review link, advances the article to `DOCTOR_AUTO_APPROVED`, and records
an auditable `doctor.auto_approved` event. Its output identifies whether
marketing review or publishing is the next stage. It now calls the marketing
router for each auto-approved article; the router's TEST-1 guard prevents an
unmapped practice from continuing. This deadline check is intentionally
time-based; it is distinct from polling for completed stages.

The marketing-review workflows route each doctor-approved article according
to its campaign setting. Required reviews receive a separate hashed one-time
link, and the marketing portal can either grant final approval or record a
written change request that blocks publishing. For the TEST-1 route, workflow
20 revises the current package, records a new article version, and sends a new
marketing review invitation. It does not ask the doctor to approve again.
The event-driven test route
currently sends only articles requiring marketing approval. The
no-marketing-review route still needs a separate publishing handoff before it
can be used without manual follow-up.

The WordPress publishing workflow is the first publishing adapter. It only
loads approved articles for practices with an explicit WordPress publisher,
a real non-example domain, and a configured credential reference. It resolves
the approved package's publishing tokens, performs an idempotent slug-based
create or update, and records the external post ID, final URL, lifecycle state,
and audit event in BigQuery. The TEST001 practice has been configured for a
proof-of-concept WordPress post at `https://apexparent.hostmanpowered.com/test001/`.
The live adapter derives its API URL from the explicit
`publisher_config_reference.wordpress_base_url`, not the public-site field.
Both HTTP nodes use the existing `Wordpress account` credential. Marketing
approval now calls the publisher for the exact article ID; the publisher's
query and preparation step independently restrict it to `practice_test_001`
and the TEST001 WordPress editing base. A successful manual test-site publish
was recorded on September 23, but the new automatic handoff has not yet been
verified with a fresh approval. The Headless
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

The shared workbook's `Wordpress Sites` tab is the collection point for
production editing-site URLs, keyed by `Locations.Code`. Do not place
credentials there. A dentist's primary-location code joins to that same code.
On 2026-09-23, 58 eligible general-dentist locations were staged in BigQuery
`practices` with their public and WordPress URLs. These profiles are all
`active = FALSE`, have no `publisher_type` or credential, and carry
`mapping_status = UNVERIFIED`. They cannot launch campaigns or publish. The
publisher adapter remains restricted to TEST001. See
[`docs/PRACTICE_SITE_MAPPING.md`](../docs/PRACTICE_SITE_MAPPING.md) for the
initial sync, shared subsites, and verification gates. Spreadsheet changes
after this snapshot are **not automatically synced** to BigQuery yet; they
continue to appear in the read-only roster preview.

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
without repeating a successful one. A valid doctor approval now calls marketing
routing immediately; a valid change request calls revision immediately. The
marketing invitation workflow rotates a one-time link, sends it to
`ndorsey@apexdp.com`, copies `ballen@apexdp.com` and `jdold@apexdp.com`, and
records successful delivery so failures can be retried. All three recipients
share the link; the first response controls the review. After approval, the
link remains a read-only article preview until it expires.
The static-site publishing step remains manual and deferred.

Current browser endpoints:

- `POST /webhook/aac/interview/validate`
- `POST /webhook/aac/interview/start`
- `POST /webhook/aac/interview/complete`
- `POST /webhook/aac/review/validate`
- `POST /webhook/aac/review/respond`
- `POST /webhook/aac/marketing-review/validate`
- `POST /webhook/aac/marketing-review/respond`

The live workflows use credentials configured inside n8n. These exports intentionally omit credential bindings and secret values; reconnect the appropriate BigQuery and OpenAI credentials after importing them into another n8n instance.
