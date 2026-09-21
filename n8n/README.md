# n8n workflow exports

This directory stores version-controlled exports of the discrete n8n workflows used by the browser interview vertical slice.

The deployed n8n instance remains the runtime source for credentials and environment-specific configuration. Exports must never contain credentials or secrets.

Version-controlled workflow exports:

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

The article-generation workflow uses the approved prompt preserved at
`../prompts/article-generation-master-prompt.md`. It is intentionally shipped
with a manual trigger so a completed interview can be tested and reviewed
before automatic generation is enabled.

The article-revision workflow uses the dedicated prompt preserved at
`../prompts/article-revision-master-prompt.md`. It loads the latest doctor
change request, revises the current package with the original transcript and
revision history in context, inserts a new `AI_DOCTOR_REVISION` version, and
returns a fresh one-time review link. It remains manual until the vertical
slice has been verified with a real change request.

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

Current browser endpoints:

- `POST /webhook/aac/interview/validate`
- `POST /webhook/aac/interview/start`
- `POST /webhook/aac/interview/complete`
- `POST /webhook/aac/review/validate`
- `POST /webhook/aac/review/respond`
- `POST /webhook/aac/marketing-review/validate`
- `POST /webhook/aac/marketing-review/respond`

The live workflows use credentials configured inside n8n. These exports intentionally omit credential bindings and secret values; reconnect the appropriate BigQuery and OpenAI credentials after importing them into another n8n instance.
