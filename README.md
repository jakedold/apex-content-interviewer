# Apex Content Interview and Review App

The clinician-facing voice interview and article-review application for the Apex Dental Partners Automated Article Creation system.

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

## Deployment

The repository is designed for Cloudflare Workers Builds connected to the `main` branch. The Worker configuration is in `wrangler.jsonc`; the deploy command is:

```bash
npm run deploy
```

`N8N_BASE_URL` is non-secret configuration. Credentials and API keys must not be committed to this repository.

## Project architecture

The authoritative product and workflow direction is in [docs/PROJECT_ARCHITECTURE.md](docs/PROJECT_ARCHITECTURE.md). n8n workflow exports retained with the application live in [n8n/](n8n/).
