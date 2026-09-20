# n8n workflow exports

This directory stores version-controlled exports of the discrete n8n workflows used by the browser interview vertical slice.

The deployed n8n instance remains the runtime source for credentials and environment-specific configuration. Exports must never contain credentials or secrets.

Current browser endpoints:

- `POST /webhook/aac/interview/validate`
- `POST /webhook/aac/interview/start`
- `POST /webhook/aac/interview/complete`

The tested interview-completion workflow was deployed in n8n as `AAC - 05 - Interview Completed`. Export the live workflow into this directory after confirming credentials are omitted. Do not reconstruct the production BigQuery statements from memory when the live export is available.
