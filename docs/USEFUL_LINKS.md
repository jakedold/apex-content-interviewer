# Useful links

Bookmark this page for the Automated Article Creation system. Links to n8n
and Google Sheets require the appropriate account access.
Do not put interview, review, or marketing-review links containing secure tokens
in this file.

## Start or preview a campaign

| Link | What it is | Current status |
| --- | --- | --- |
| [Start a test article campaign](https://n8n.apexdentalautomation.com/form/aac-test-campaign-launch) | Protected, multi-step test-only launcher | **Active.** Reads the workbook's `Test User` tab, limits selection to TEST-1 and its listed recipients, displays a final recipient confirmation, and requires `SEND TEST INVITATIONS`. A September 2026 test campaign was launched for the one listed test email. Do not add real dentists to `Test User`. |
| [Test campaign launcher workflow](https://n8n.apexdentalautomation.com/workflow/KvuBYWElqsvKx8lf) | n8n editor and execution history | Active test-only workflow; review failed executions here rather than trusting the form's generic “Submitted” page. |
| [Original campaign launcher](https://n8n.apexdentalautomation.com/workflow/k2NuDbJccRdiyTTx) | Older free-entry form | **Inactive.** Do not use for live dentists until the production roster and site mapping are separately validated. |
| [Campaign roster selection preview](https://n8n.apexdentalautomation.com/form/aac-roster-selection-preview) | Protected, read-only form using the four workbook tabs | **Active preview.** Choose Test users or general dentists; leave the exclusion boxes unchecked to include all, then check only the locations or recipients to omit. It cannot create a campaign, send emails, or publish. The doctor-sending launcher remains disabled. [Workflow editor](https://n8n.apexdentalautomation.com/workflow/49aNWb8s90rbD0nA). |
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
The TEST-1 test-user row and its BigQuery practice profile are mapped to the
WordPress editing subsite `https://apexparent.hostmanpowered.com/test001/`.
This does not authorize publishing for other locations.

The marketing-review invitation is addressed to Nicole Dorsey
(`ndorsey@apexdp.com`) and copies Brenna Allen (`ballen@apexdp.com`) and
Jake Dold (`jdold@apexdp.com`). They receive the same secure review link;
the first submitted decision controls the workflow. After approval, the
link remains read-only for the other reviewers until it expires.

## Prompts and project reference

| Link | Purpose |
| --- | --- |
| [Prompt library and update instructions](../prompts/README.md) | Start here to see which prompt runs where and how changes are deployed. |
| [Voice interviewer prompt](../prompts/voice-interviewer.md) | Clinician interview prompt, versioned in GitHub. |
| [Article-generation prompt](../prompts/article-generation-master-prompt.md) | First-draft writing prompt. |
| [Article-revision prompt](../prompts/article-revision-master-prompt.md) | Revises a draft after doctor feedback. |
| [Workflow inventory and operating notes](../n8n/README.md) | Exported n8n workflows and current setup notes. |
| [Apex brand reference](BRANDING.md) | Visual tokens, assets, and where interview/review styling is maintained. |
| [Marketing approval workflow](https://n8n.apexdentalautomation.com/workflow/X5X9i3hq0nokxd2U) | Records the review decision; approved TEST-1 articles start WordPress publishing. |
| [WordPress publishing workflow](https://n8n.apexdentalautomation.com/workflow/kGd2YSJ2MVJwRld0) | Called after marketing approval for an exact TEST-1 article; static-site release remains separate. |
| [Shortcoder field guide](SHORTCODER.md) | Verified practice shortcode names and publishing limits. |
| [Project architecture](PROJECT_ARCHITECTURE.md) | System design and build direction. |
| [Known issues](KNOWN_ISSUES.md) | Documented low-priority interface and workflow issues. |

For a prompt change, follow the instructions in the prompt library. Editing a
Markdown file alone does not update a prompt embedded in a live n8n workflow.
