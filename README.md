# Apex Content Interview and Review App

The clinician-facing voice interview and article-review application for the Apex Dental Partners Automated Article Creation system.

For launch, roster, test-entry, and prompt-library links, see [Useful links](docs/USEFUL_LINKS.md).
For the Apex visual style and checked-in brand assets, see [Branding](docs/BRANDING.md).

Doctors open a secure topic-specific link, complete an OpenAI Realtime voice interview, and save the resulting transcript through n8n to BigQuery. When a draft is ready, a separate secure review link lets the doctor approve it or request changes. A change request creates a new immutable article version and a fresh one-time review link, preserving the full revision history. Pending doctor reviews automatically approve after their configured deadline, with the expiration recorded separately from a manual approval. The app is a Vite/TypeScript single-page application deployed with a Cloudflare Worker that proxies same-origin API routes to n8n.

## Application flow

```text
/interview/{secure_token}
  -> POST /api/validate
  -> POST /api/start
  -> OpenAI Realtime voice interview
  -> POST /api/complete
  -> n8n
  -> BigQuery

/review/{secure_token}
  -> POST /api/review/validate
  -> review the canonical article version
  -> POST /api/review/respond
  -> BigQuery approval state and audit event
```

The interview UI includes microphone startup, visible loading/thinking/speaking states, pause/resume, transcript capture, and completion persistence. The review UI sanitizes the stored article HTML with an explicit element and link allowlist before rendering it.

The marketing control center lives at `/admin`. It reads campaign, doctor, article, workflow event, and communication state directly from BigQuery after validating Cloudflare Access identity. Setup and activation requirements are documented in [Admin dashboard](docs/ADMIN_DASHBOARD.md).

## Making changes with Claude Code

Nicole can describe a requested change in ordinary language and let Claude Code handle the repository work. See [Nicole's simple Claude Code guide](docs/CLAUDE_CODE_STARTER_PROMPT.md) for the one-time kickoff prompt and what happens before a change reaches the live app.

## Local development

```bash
npm install
npm run dev
```

Open an interview URL supplied by the n8n link-generation workflow:

```text
http://localhost:5173/interview/{token}
```

The Cloudflare Vite plugin runs the Worker locally, so `/api/validate`, `/api/start`, and `/api/complete` use the same routing as production.

## Validation

```bash
npm run build
```

## Prompt editing

The voice interviewer prompt and the separate article-writing and revision prompts are documented in [prompts/README.md](prompts/README.md), including where to view their Git history and which live component uses each file.

## Deployment

Pull requests to `main` run `.github/workflows/validate-pr.yml`. It generates Worker types, builds the app, runs the automated tests, and parses the n8n workflow exports. This check does not receive the Cloudflare token and cannot deploy. Review and merge only after the pull request check passes.

Every push to `main` runs `.github/workflows/deploy.yml`, which builds the app, runs `node --test scripts/*.test.mjs`, and deploys the Worker only if both pass. Manual runs are limited to `main`. The workflow needs a `CLOUDFLARE_API_TOKEN` GitHub Actions secret; without it, the deploy step is skipped. Scope the Cloudflare token to the existing `apex-content-interviewer` Worker with the **Editor** permission. Cloudflare documents this as sufficient for deploying an existing Worker; add a zone-level Workers Routes permission only if a deployment also needs to change a route or custom domain. Never commit the token to the repository.

The Worker configuration is in `wrangler.jsonc`. A deploy replaces dashboard-edited variables with the values in that file, so change variables there rather than in the Cloudflare dashboard; secrets are not affected. To deploy manually:

```bash
npm run deploy
```

`N8N_BASE_URL` is non-secret configuration. Credentials and API keys must not be committed to this repository.

## Project architecture

The authoritative product and workflow direction is in [docs/PROJECT_ARCHITECTURE.md](docs/PROJECT_ARCHITECTURE.md). n8n workflow exports retained with the application live in [n8n/](n8n/).
