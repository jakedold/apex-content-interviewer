# Repository instructions

Use `docs/PROJECT_ARCHITECTURE.md` as the source of truth for this application and the broader Automated Article Creation system.

- Keep the doctor-facing experience intentionally minimal.
- Preserve BigQuery as the system of record and n8n as the orchestration layer.
- Keep `/api/validate`, `/api/start`, and `/api/complete` behind the same-origin Cloudflare Worker proxy.
- Never commit secrets, API keys, temporary Realtime credentials, secure interview tokens, transcripts, or patient information.
- Treat the interview agent and article-writing agent as separate systems.
- Prefer small, testable changes and complete importable n8n JSON exports.
- Preserve explicit pause/resume, loading, thinking, speaking, saving, and completion states.
- Run `npm run build` before committing application changes.
