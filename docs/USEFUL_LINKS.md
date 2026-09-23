# Useful links

Bookmark this page for the Automated Article Creation system. Links to n8n,
Google Sheets, and the test data tables require the appropriate account access.
Do not put interview, review, or marketing-review links containing secure tokens
in this file.

## Start or preview a campaign

| Link | What it is | Current status |
| --- | --- | --- |
| [Launch an article campaign](https://n8n.apexdentalautomation.com/form/aac-launch-article-campaign) | Administrator launch form | **Unavailable while its workflow is inactive.** This form creates a campaign and queues invitations; do not activate it until the roster, site mapping, and sending safeguards are ready. |
| [Launch-form workflow](https://n8n.apexdentalautomation.com/workflow/k2NuDbJccRdiyTTx) | n8n editor for the launch form | Inactive as checked September 23, 2026. |
| [Roster-driven selection preview](https://n8n.apexdentalautomation.com/workflow/dcenQwsnrc7ljMoR) | Staging workflow to review eligible locations and dentists from the sheets | Inactive; preview only. It does not create campaigns or send emails. |
| [Test-practices-and-emails preview](https://n8n.apexdentalautomation.com/workflow/eQDcQhZmaNB8sVZE) | Checks temporary test entries | Inactive; does not save entries or send emails. |

## Add or check practices and people

| Link | What it contains | How to use it |
| --- | --- | --- |
| [Test practices](https://n8n.apexdentalautomation.com/projects/XtX0LN69PLAISkda/datatables/vyWqiwFpRvYDGnW6) | Separate n8n list with practice name, public website, and WordPress editing-site URL | Use **Add Row** for a test practice. This list is not connected to invitations. |
| [Test emails](https://n8n.apexdentalautomation.com/projects/XtX0LN69PLAISkda/datatables/UVcspQQJPdgtgf9q) | Separate n8n list with email and practice name | Use **Add Row** and match the practice name to the test-practices list. This list is not connected to invitations. |
| [Master Location List](https://docs.google.com/spreadsheets/d/1fAP9gu66_rwZ9xUCjmxdql-FznlG-PQvepVaH6ThmnE/edit) | Current location list and public websites (`Master List` tab) | Working location source for the staging selection preview. Public static websites are **not** WordPress editing-site URLs. |
| [Employee Census / doctor list](https://docs.google.com/spreadsheets/d/1M0arM4jnZzalySGUKq60Hp1yhTDz2RQTXqMeOWfaOUA/edit) | Dentist names, primary locations, employment type, and work emails (`Sheet1` tab) | Working doctor source for the staging selection preview. Only full- and part-time general dentists at eligible locations are selected. |
| [WordPress site map](https://docs.google.com/spreadsheets/d/1eP8YmH9vwCFXQ80_VjPXrGj6SGa1k3d2Ux00Xfcbw6A/edit) | Separate working sheet with 58 eligible practice codes, names, and public websites | Fill the yellow **WordPress editing URL** column. Do not enter passwords or application credentials. This map is not yet connected to publishing. |

The two Google Sheets are the current working roster sources because the
expected BigQuery source tables are not yet usable for this selection step.
BigQuery remains the intended system of record. The test lists are separate
from both sheets; adding a row to either test list does not launch a campaign.
For production practices, match the doctor's primary-location code in the
Employee Census to the code in the Master Location List, then to the same code
in the WordPress site map. Do not match by website domain or doctor email;
several practices share a public domain. The WordPress map is a staging input,
not yet the BigQuery publishing configuration.

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
