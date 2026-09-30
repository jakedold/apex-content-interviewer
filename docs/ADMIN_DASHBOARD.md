# Admin Content Operations Dashboard

The read-only admin control center is available at `/admin`.

It provides:

- campaign history and completion progress
- doctor/topic/article work queue views
- status and urgency filtering
- recent workflow event timelines
- workflow and communication failure surfaces
- read-only capability metadata and reserved UI space for future audited actions

BigQuery remains the system of record. The Worker queries it directly with a read-only service account. n8n is not used as a database or read API; it remains the orchestration and workflow diagnostics layer.

The live detail view now reads the complete work-item context directly from BigQuery: transcript, current immutable article version, practice website and publishing route, approvals, communications, and linked workflow events. The stage tracker is based on explicit lifecycle state rather than guessing from elapsed time.

Administrative mutations use a separate boundary:

- `POST /api/admin/commands` accepts only narrow, allowlisted command types.
- The Worker revalidates the Cloudflare Access identity and requires an explicitly assigned administrator email.
- Each request requires an idempotency key and is forwarded to the private n8n command webhook with a shared secret.
- `n8n/24-admin-command-router.json` performs state checks, writes the audit event and command record in BigQuery, and only then continues orchestration.
- The BigQuery dashboard credential remains read-only and cannot be used for mutations.

Actions remain disabled until `ADMIN_ACTION_EMAILS`, `ADMIN_COMMAND_PATH`, and the `ADMIN_COMMAND_SECRET` Worker secret are configured and the n8n workflow has its Header Auth and BigQuery credentials connected. This is intentional: the existing Cloudflare Access policy permits a broad Workspace audience for viewing, which must not automatically grant approval or campaign-launch authority.

## Current application shape

The repository currently uses a Vite TypeScript SPA and a Cloudflare Worker. This foundation preserves that working interview/review deployment rather than combining an Astro migration with the new admin data plane. The admin client and Worker handler are isolated in `src/admin.ts`, `src/admin.css`, and `worker/admin.ts` so a later Astro route migration can keep the same `/api/admin/overview` contract.

## Security model

The dashboard uses defense in depth:

1. Configure a Cloudflare Access self-hosted application for `/admin*` and `/api/admin/*` using the Apex Google Workspace identity provider and an allow policy for the intended admin group or email domain.
2. The Worker validates the signed `Cf-Access-Jwt-Assertion` header, issuer, and application audience before querying BigQuery.
3. The BigQuery service account should have only the permissions needed to run read-only queries.
4. The response is marked `private, no-store`.
5. The current API exposes only `GET /api/admin/overview`. There are no mutation endpoints.

Cloudflare configuration values:

| Name | Purpose |
| --- | --- |
| `ADMIN_ACCESS_TEAM_DOMAIN` | Access team domain, such as `example.cloudflareaccess.com` |
| `ADMIN_ACCESS_AUD` | Audience tag for the Access application protecting the admin routes |
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
overview.summary
overview.campaigns
overview.work_queue
overview.recent_events
overview.communication_failures
```

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

## Test campaign launcher

The dashboard campaign builder intentionally mirrors the active n8n test-only launcher before production dentist launch is enabled.

For each campaign:

1. Choose the **Test users only** audience.
2. Enter the campaign name and month.
3. Prepare exactly three distinct topics.
4. Upload one approved featured image per topic to the Apex Parent central Media Library:
   `https://apexparent.hostmanpowered.com/wp-admin/upload.php?mlo-category=all-files`
5. For each topic, record the direct `https://apexparent.hostmanpowered.com/wp-content/uploads/...` file URL, useful alt text, source type, and rights/source reference.
6. Choose the verified TEST001 practice and one or more active test recipients.
7. Type `SEND TEST INVITATIONS` exactly before launch.

The dashboard and n8n command workflow both validate these requirements. Campaign launch stores the image provenance with the topic in BigQuery before any invitation can be dispatched.

The legacy workflow named **AAC - 02 - Create Topic Interview Links** is an old manual POC and should remain inactive. It is not the scheduled invitation workflow. The scheduled sender is **AAC - 02 - Dispatch Campaign Invitations**.

## Presentation demo scheduling

The admin campaign builder supports a TEST001-only **Presentation demo recipients** audience for internal demonstrations. Administrators can paste up to 50 `Name,email` recipients. n8n creates isolated `doctor_demo_...` identities so existing production doctor records are not overwritten.

Campaign invitations can be sent immediately or scheduled using a local date/time plus an explicit IANA timezone. Scheduled campaigns are stored as `SCHEDULED` with `invitation_send_at`; the invitation dispatcher releases them when that timestamp becomes due.

The dispatcher remains on its five-minute trigger. A due run can prepare up to 50 recipients at once, then loops through those invitations one recipient at a time through the existing private doctor-message workflow. This is intended to let a presentation cohort of roughly 30 doctors begin receiving invitations within a few minutes of the scheduled release without increasing BigQuery polling frequency.

The presentation route is still a test route. Article generation and WordPress publishing remain restricted to `practice_test_001` until the production doctor/site mappings are separately validated.
