# Prompts and version history

This directory is the human-readable, Git-versioned home for the three distinct AI prompts:

| File | Used for | Runtime copy |
| --- | --- | --- |
| `voice-interviewer.md` | Live clinician voice interview | Imported by `src/voicePrompt.ts` into the browser app |
| `article-generation-master-prompt.md` | First article draft | Embedded in `n8n/06-generate-article.json` |
| `article-revision-master-prompt.md` | Doctor-requested revisions | Embedded in `n8n/10-revise-article-from-doctor-feedback.json` |

To review a prompt, open its file on GitHub in the `jakedold/apex-content-interviewer` repository. Use GitHub's **History** button on that file to see earlier versions and who changed them. Propose edits through a pull request so the wording and reason can be reviewed before merging to `main`.

For the voice interviewer, edit `voice-interviewer.md`, preserve the `{{PLACEHOLDER}}` names, run `npm run build`, and deploy the app. `src/voicePrompt.ts` supplies the doctor, practice, topic, and guidance at runtime. The prompt file is used directly; there is no separate n8n copy of it.

For article generation or revision, changing the Markdown file alone does **not** change the running n8n workflow. Run `node scripts/sync-n8n-prompts.mjs` to refresh the version-controlled workflow JSON, then update and test the corresponding live n8n code node. Keep the Markdown, exported JSON, and live n8n copy synchronized. The confirmed WordPress fields and their limits are documented in [`docs/SHORTCODER.md`](../docs/SHORTCODER.md). Do not include credentials, secure links, patient information, or interview transcripts in Git.
