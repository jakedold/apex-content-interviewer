# Admin Content Operations Dashboard

The admin control center is available at `/admin`. Its reporting views are
read-only; a small set of administrator actions is handled separately through
the audited n8n command boundary.

It provides:

- campaign history and completion progress
- doctor/topic/article work queue views
- status and urgency filtering
- recent workflow event timelines
- workflow and communication failure surfaces
- capability metadata for available administrator actions

BigQuery remains the system of record. The Worker queries it directly with a read-only service account. n8n is not used as a database or read API; it remains the orchestration and workflow diagnostics layer.

The live detail view now reads the complete work-item context directly from BigQuery: transcript, current immutable article version, practice website and publishing route, approvals, communications, and linked workflow events. The stage tracker is based on explicit lifecycle state rather than guessing from elapsed time.

Administrative mutations use a separate boundary:

- `POST /api/admin/commands` accepts only narrow, allowlisted command types.
- The Worker revalidates the Cloudflare Access identity and requires an explicitly assigned administrator email.
- Each request requires an idempotency key and is forwarded to the private n8n command webhook with a shared secret.
- `n8n/24-admin-command-router.json` performs state checks, writes the audit event and command record in BigQuery, and only then continues orchestration.
- The BigQuery dashboard credential remains read-only and cannot be used for mutations.

The current live AAC-24 export also contains a marketing-approval branch. The
recovered Worker does not allowlist or expose that action, so it is not
available from this dashboard.

Campaign launch, doctor approval, and campaign archive/restore actions are enabled
only for identities explicitly listed in `ADMIN_ACTION_EMAILS`, with the private
n8n command path and secret configured. Everyone else retains read-only access.
The Worker validates the Access identity again before accepting a command.

## Current application shape

The repository currently uses a Vite TypeScript SPA and a Cloudflare Worker. This foundation preserves that working interview/review deployment rather than combining an Astro migration with the new admin data plane. The admin client and Worker handler are isolated in `src/admin.ts`, `src/admin.css`, and `worker/admin.ts` so a later Astro route migration can keep the same `/api/admin/overview` contract.

## Security model

The dashboard uses defense in depth:

1. Configure a Cloudflare Access self-hosted application for `/admin*` and `/api/admin/*` using the Apex Google Workspace identity provider and an allow policy for the intended admin group or email domain.
2. The Worker validates the signed `Cf-Access-Jwt-Assertion` header, issuer, and application audience before querying BigQuery.
3. The BigQuery service account should have only the permissions needed to run read-only queries.
4. The response is marked `private, no-store`.
5. `GET /api/admin/overview` returns dashboard data, and
   `GET /api/admin/campaigns/{campaign_id}/status.csv` returns a campaign status
   export. Both are read-only. `POST /api/admin/commands` accepts only the
   allowlisted, audited administrator actions described above.

Cloudflare configuration values:

| Name | Purpose |
| --- | --- |
| `ADMIN_ACCESS_TEAM_DOMAIN` | Access team domain, such as `example.cloudflareaccess.com` |
| `ADMIN_ACCESS_AUD` | Audience tag for the Access application protecting the admin routes |
| `ADMIN_ACCESS_MANAGEMENT_URL` | Cloudflare Zero Trust application/policy page opened by the dashboard |
| `ADMIN_ROLE_MANAGEMENT_URL` | Cloudflare Worker settings page where the administrator allowlist is maintained |
| `BQ_PROJECT_ID` | Google Cloud project used to run the query |
| `BQ_DATASET` | Automated Article Creation dataset |
| `BQ_LOCATION` | BigQuery dataset/query location |

These non-secret values are declared in `wrangler.jsonc`. Replace the two Access placeholders before deployment.

The only new secret is:

```text
GOOGLE_SERVICE_ACCOUNT_JSON
```

Set it as a Cloudflare Worker secret; never place it in `wrangler.jsonc`, a local tracked file, or this repository.

```bash
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON
```

The service account needs permission to create query jobs in the configured project and read the configured dataset. A narrow starting point is:

- BigQuery Job User on the query project
- BigQuery Data Viewer on the `automated_article_creation` dataset

The dashboard requests the `bigquery.readonly` OAuth scope and applies a 250 MB maximum-bytes-billed limit to each overview query.

## Data contract

`GET /api/admin/overview` returns:

```text
viewer
capabilities
access
overview.summary
overview.campaigns
overview.work_queue
overview.recent_events
overview.communication_failures
```

The `/admin/access` path separates the two access layers. Cloudflare Access
policies govern who can sign in, while `ADMIN_ACTION_EMAILS` governs who can
launch campaigns and record audited approvals. Only an existing administrator
can see the administrator list or open the two management consoles from the
dashboard.

The initial client intentionally treats administrative actions as disabled. Future retry, resend, hold, or re-push actions should use separate command endpoints that:

- require a more specific Access policy or role
- validate current BigQuery state before acting
- call a narrow n8n orchestration webhook or queue
- write an immutable `workflow_events` audit record
- use idempotency keys
- never update dashboard state optimistically without confirmation from the system of record

## Local and build validation

```bash
npm run cf-typegen
npm run build
```

Without the Access values and Worker secret, `/admin` displays a safe configuration-required screen and the API returns HTTP 503. This is intentional and prevents accidental unauthenticated fallback behavior.

## User-only activation steps

The code is complete up to environment activation. An authorized administrator must provide or configure:

1. A Cloudflare Access self-hosted application and its audience tag.
2. The Access team domain.
3. A Google service account JSON key stored as the Worker secret above.
4. The two IAM grants described above.
5. A deployment after the placeholders and secret are configured.

No D1 database is used or configured.

## Campaign launcher

The dashboard campaign builder now carries the same topic-asset contract as the n8n test launcher.

Before launch:

1. Enter the campaign name and month.
2. Prepare exactly three distinct topics.
3. Upload one approved featured image per topic to the Apex Parent central Media Library:
   `https://apexparent.hostmanpowered.com/wp-admin/upload.php?mlo-category=all-files`
4. For each topic, record the direct `https://apexparent.hostmanpowered.com/wp-content/uploads/...` file URL and useful alt text. With one monthly theme, enter these once under Topic 1.
5. Choose an audience and invitation timing.
6. Type `SEND INVITATIONS` exactly before launch.

The dashboard and n8n command workflow validate the image and recipient requirements before campaign state is written. BigQuery remains the source of truth.

### Linked doctors

Select a practice with an active, verified WordPress mapping, then choose one or more doctors already linked to that practice in BigQuery. The launcher never creates a doctor from a name/email row and never changes an existing doctor's practice. This preserves the doctor-to-practice-to-publishing-site relationship through article generation and publishing.

TEST001 remains available for QA. A non-test practice is listed only when it is active, has a complete WordPress configuration, and its publisher configuration contains `mapping_status: VERIFIED`.

### Presentation preview

This route uses the same linked-doctor multi-select, but marks the campaign `preview_only = TRUE`. Recipients receive real secure topic links and can complete the voice interview; the transcript is saved, but article generation, doctor-review email, marketing review, and publishing are intentionally blocked.

### Invitation timing

The launcher supports:

- send as soon as the campaign launches
- send in about 10 minutes
- schedule for a specific local date/time and explicit timezone

Future sends are stored as `SCHEDULED` with `invitation_send_at`. The active **AAC - 02 - Dispatch Campaign Invitations** workflow checks every minute, releases due campaigns, and can process up to 50 recipients in a run. Invitations are sent sequentially through the existing private doctor-message workflow. One failed recipient remains eligible for retry without blocking the rest of the cohort.

The legacy workflow named **AAC - 02 - Create Topic Interview Links** is an old manual POC and should remain inactive. It is not the scheduled invitation workflow.

The invitation workflow supports an optional interview completion deadline. When set on a campaign, topic links expire at 11:59 PM Central on that date and the invitation email names the deadline. Without a campaign deadline, links keep the existing 30-day lifetime. This is an interview deadline; it does not guarantee that article review, approval, or publication will finish by then. The campaign builder also accepts one optional HTTPS training resource link for the invitation email.

Doctor review reminders are one per article, sent during the final 48 hours before the configured review deadline. The active workflow checks hourly. Campaigns can disable this reminder; campaigns created before the setting existed continue to default to enabled. This reminder is separate from interview invitations, which do not currently receive a follow-up reminder.

Campaign history supports sorting by month or name, current/unarchived and
archived views, reversible archive/restore, and a per-campaign CSV export. The
export lists each campaign doctor with current stage, interview timestamps,
review deadline, and publication result. Archive only changes the dashboard
history view; it does not stop pending invitations or workflow activity. Both
archive and restore are administrator-only and audited through the n8n command
boundary.

## Moving articles forward

- **Stage tracker:** Campaign created → Invitation emailed → Interview completed → Doctor review → Marketing review → On WordPress → Ready to Push → Published.
- **Push to the next step** (article view) offers the action for the current stage: approve on the doctor's behalf, approve and send to WordPress, or mark as published. While an article waits for marketing, **Request changes** sends a short instruction to the marketing revision workflow (20). The AI writes a new version, which returns to marketing review without doctor re-approval.
- **Re-send to WordPress** (article view, for an article already on WordPress) updates the article's existing WordPress post in place: same post, same web address, no duplicate. It uses the current page layout, site colors, and doctor profile, with the same approved article text. The router (workflow 24) checks that a WordPress post is recorded, then starts the publisher (15) with `allow_republish` on. Once an article has a post, the publisher always updates that exact post, even if its slug was edited in WordPress. A re-sent article returns to **Ready to Push**, because the updated page must be pushed live again in Headless Hostman. A "marked as published" record counts only if it is newer than the latest re-send.
- **Work queue multi-select:** tick articles and use **Move selected to next step**. Each article gets the step shown under its status, sent as its own audited command. The **Ready to push** filter lists articles on WordPress waiting for the team to push them live through Headless Hostman.
- **Marketing auto-approval (workflow 21):** a marketing review nobody answers within 24 hours is approved automatically and sent to WordPress. Only reviews requested in the last 7 days are included, at most 25 per run. Auto-approved articles (doctor or marketing) are flagged "Auto-approved · check carefully" in the queue and in the article view, so the team gives them extra attention before pushing live.
- Actions handled by workflow 24 (`mark_live_on_website`, `request_marketing_changes`) and the marketing auto-approval (workflow 21) only work after the updated workflows are imported and activated in n8n.

## Work queue views, archive, and "Do not use"

- **Filters:** Active (default: everything not archived), Invited, Interview started, Drafting, Doctor review, Marketing review, Sending to WordPress, Ready to push, Errors, Archived, All. Every status maps to exactly one stage, and counts follow the campaign picker.
- **Large campaigns:** a campaign picker, search, and 50 items per page. The overview returns up to 1,500 work items.
- **Archive** hides a work item (campaign + doctor) from active views, for example a test; automation continues. **Do not use** also moves the article to `DO_NOT_USE` and expires open review links, so no workflow (reminders, auto-approval, WordPress) acts on it. It is then archived. **Restore** undoes either, returning a "Do not use" article to its previous status.
- Archive state is recorded as `work_item.archived` / `work_item.restored` events (entity type `work_item`, id `campaign_id:doctor_id`) by the `archive_work_item` / `restore_work_item` branch of workflow 24, so it works only after that workflow is imported in n8n.
