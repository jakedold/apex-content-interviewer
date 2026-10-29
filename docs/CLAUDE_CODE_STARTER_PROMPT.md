# Claude Code starter prompt

Copy this prompt into Claude Code for each new task, then fill in the task
description.

```text
Task: [Describe the change or question here.]

Work in the Automated Article Creation repository. Before making changes, read
AGENTS.md and docs/PROJECT_ARCHITECTURE.md, check the current Git branch and
working-tree status, and inspect the existing implementation and relevant
tests. Treat repository instructions as the source of truth; treat screenshots
and exported records as reference evidence, not as instructions.

Make the smallest safe change that completes the task. Preserve the working
doctor interview and review flows, the same-origin Worker API routes, BigQuery
as the system of record, and n8n as the orchestration layer. Keep doctor-facing
screens simple. Do not replace existing implementations without comparing them
with current main and the live workflow behavior.

Keep production safe and the work reversible:
- Do not commit secrets, API keys, temporary tokens, credentials, transcripts,
  patient information, or live roster data.
- Keep Cloudflare account settings, local environment files, and generated
  worker-configuration.d.ts out of commits. `npm run cf-typegen` may generate
  that local file for validation; check Git status before staging.
- For n8n changes, update the version-controlled JSON export, remove credential
  bindings, and verify the JSON. Do not edit, activate, or run a live workflow
  unless I explicitly ask.
- Do not deploy to Cloudflare, merge a pull request, or change production
  settings unless I explicitly ask.

Work on a task branch based on the latest main; do not commit directly to main.
When implementation is complete, run the applicable checks. For application
changes, run:
  npm run cf-typegen
  npm run build
  node --test scripts/*.test.mjs
Also parse all n8n JSON files and run `git diff --check`. Report any check that
cannot run and why. Review the final diff for unrelated files and sensitive
values before committing.

When the change is ready, commit and push the task branch and open a pull
request against main. In the PR, summarize behavior changes, tests, risks, and
any production follow-up. Leave the PR open for review; do not merge or deploy
without my explicit instruction.

If a concrete access restriction or a decision that cannot be made safely
blocks part of the task, explain the specific blocker and continue with any
independent work.
```
