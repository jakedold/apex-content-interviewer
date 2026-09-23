# Useful links

Bookmark this page for the Automated Article Creation system. Links to n8n
and Google Sheets require the appropriate account access.
Do not put interview, review, or marketing-review links containing secure tokens
in this file.

## Start or preview a campaign

| Link | What it is | Current status |
| --- | --- | --- |
| [Launch an article campaign](https://n8n.apexdentalautomation.com/form/aac-launch-article-campaign) | Administrator launch form | **Unavailable while its workflow is inactive.** The invitation dispatcher is active; do not activate this form or create READY recipients until roster, site mapping, and sending safeguards are ready. |
| [Launch-form workflow](https://n8n.apexdentalautomation.com/workflow/k2NuDbJccRdiyTTx) | n8n editor for the launch form | Inactive as checked September 23, 2026. |
| [Unified roster selection preview](https://n8n.apexdentalautomation.com/workflow/49aNWb8s90rbD0nA) | Staging workflow for locations and recipients from the four workbook tabs | Inactive; connected to the workbook with privacy-limited reads. No email or campaign-write steps. Form authentication and end-to-end behavior still need testing. |
| [Test-practices-and-emails preview](https://n8n.apexdentalautomation.com/workflow/eQDcQhZmaNB8sVZE) | Checks temporary test entries | Inactive; does not save entries or send emails. |

## Add or check practices and people

| Link | What it contains | How to use it |
| --- | --- | --- |
| [Doctor Census](https://docs.google.com/spreadsheets/d/1M0arM4jnZzalySGUKq60Hp1yhTDz2RQTXqMeOWfaOUA/edit?gid=0#gid=0) | Doctor name, primary location, employment type, work email | Refresh the census here. Only full- and part-time general dentists at eligible locations are selected. |
| [Locations](https://docs.google.com/spreadsheets/d/1M0arM4jnZzalySGUKq60Hp1yhTDz2RQTXqMeOWfaOUA/edit?gid=1793196368#gid=1793196368) | Location code, name, type, public static website | Update when practices change. The public URL is not the WordPress editing URL. |
| [Wordpress Sites](https://docs.google.com/spreadsheets/d/1M0arM4jnZzalySGUKq60Hp1yhTDz2RQTXqMeOWfaOUA/edit?gid=1739296062#gid=1739296062) | Location code, name, WordPress editing-site URL | Match by location code; update for new sites. Do not store passwords or credentials here. |
| [Test User](https://docs.google.com/spreadsheets/d/1M0arM4jnZzalySGUKq60Hp1yhTDz2RQTXqMeOWfaOUA/edit?gid=1246014176#gid=1246014176) | Test email, name, location, WordPress URL | Add test recipients here. These are a separate audience and must never be mixed into a dentist campaign. |

All four tabs are in the [Authoritative Blog Article Distribution workbook](https://docs.google.com/spreadsheets/d/1M0arM4jnZzalySGUKq60Hp1yhTDz2RQTXqMeOWfaOUA/edit).
The doctor primary-location code joins to `Locations.Code` and then
`Wordpress Sites.Codes`. Do not match by public domain or email. The test-user
tab is independent: its location and WordPress URL are provided directly.
Sheet edits alone do not launch campaigns or send invitations. BigQuery remains
the system of record for workflow state. The older master-location sheet,
separate WordPress map, and n8n Test Practices/Test Emails data tables are
superseded as inputs; retain them for reference until migration is verified.
The WordPress tab is not yet synced into the BigQuery publishing configuration.

## Prompts and project reference

| Link | Purpose |
| --- | --- |
| [Prompt library and update instructions](../prompts/README.md) | Start here to see which prompt runs where and how changes are deployed. |
| [Voice interviewer prompt](../prompts/voice-interviewer.md) | Clinician interview prompt, versioned in GitHub. |
| [Article-generation prompt](../prompts/article-generation-master-prompt.md) | First-draft writing prompt. |
| [Article-revision prompt](../prompts/article-revision-master-prompt.md) | Revises a draft after doctor feedback. |
| [Workflow inventory and operating notes](../n8n/README.md) | Exported n8n workflows and current setup notes. |
| [Project architecture](PROJECT_ARCHITECTURE.md) | System design and build direction. |

For a prompt change, follow the instructions in the prompt library. Editing a
Markdown file alone does not update a prompt embedded in a live n8n workflow.
