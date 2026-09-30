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
| [Doctor Profiles](https://docs.google.com/spreadsheets/d/1M0arM4jnZzalySGUKq60Hp1yhTDz2RQTXqMeOWfaOUA/edit?gid=2079115326#gid=2079115326) | Verified byline credentials, profile link, headshot source, and short bio | Replace the inactive sample row with verified public information. Mark `Active` only when the row is complete and approved. The [manual TEST-1 sync workflow](https://n8n.apexdentalautomation.com/workflow/vWmjE7uOXhLNo8tg) validates and copies the active pilot row into BigQuery; it sends no messages and publishes nothing. |

All five operational tabs are in the [Authoritative Blog Article Distribution workbook](https://docs.google.com/spreadsheets/d/1M0arM4jnZzalySGUKq60Hp1yhTDz2RQTXqMeOWfaOUA/edit).
The doctor primary-location code joins to `Locations.Code` and then
`Wordpress Sites.Codes`. Do not match by public domain or email. The test-user
tab is independent: its location and WordPress URL are provided directly.
Sheet edits alone do not launch campaigns or send invitations. BigQuery remains
the system of record for workflow state. The older master-location sheet,
separate WordPress map, and n8n Test Practices/Test Emails data tables are
superseded as inputs; retain them for reference until migration is verified.
An [initial, inactive BigQuery mapping](PRACTICE_SITE_MAPPING.md) now records
58 general-dentist practices and their WordPress editing URLs. It does not
automatically follow later spreadsheet edits or enable real-site publishing.
The TEST-1 test-user row and its BigQuery practice profile are mapped to the
WordPress editing subsite `https://apexparent.hostmanpowered.com/test001/`.
This does not authorize publishing for other locations.

The marketing-review invitation is addressed to Nicole Dorsey
(`ndorsey@apexdp.com`) and copies Brenna Allen (`ballen@apexdp.com`) and
Jake Dold (`jdold@apexdp.com`). They receive the same secure review link;
the first submitted decision controls the workflow. After approval, the
link remains read-only for the other reviewers until it expires. The
Prestonwood test campaign is an exception: its marketing invitation goes
only to Jake, without copies.

## Prompts and project reference

| Link | Purpose |
| --- | --- |
| [Prompt library and update instructions](../prompts/README.md) | Start here to see which prompt runs where and how changes are deployed. |
| [Voice interviewer prompt](../prompts/voice-interviewer.md) | Clinician interview prompt, versioned in GitHub. |
| [Article-generation prompt](../prompts/article-generation-master-prompt.md) | First-draft writing prompt. |
| [Article-revision prompt](../prompts/article-revision-master-prompt.md) | Revises a draft after doctor feedback. |
| [Marketing-revision prompt](../prompts/marketing-revision-master-prompt.md) | Revises an article after marketing requests changes; the next review returns to marketing, not the doctor. |
| [Workflow inventory and operating notes](../n8n/README.md) | Exported n8n workflows and current setup notes. |
| [Apex brand reference](BRANDING.md) | Visual tokens, assets, and where interview/review styling is maintained. |
| [Marketing approval workflow](https://n8n.apexdentalautomation.com/workflow/X5X9i3hq0nokxd2U) | Records the review decision; approved TEST-1 articles start WordPress publishing. |
| [Marketing revision workflow](https://n8n.apexdentalautomation.com/workflow/dM3OqBRiTT1xg5ub) | Handles TEST-1 marketing change requests and sends the new version for fresh marketing review. |
| [WordPress publishing workflow](https://n8n.apexdentalautomation.com/workflow/IAZwCVXtPGN97BnC) | Revised v2 inactive subworkflow called after marketing approval for an exact TEST-1 article; includes central-image copying, retry-safe media reuse, verified doctor-profile refresh, and a tightly scoped QA replay for the existing pilot post. Static-site release remains separate. |
| [Pilot topic-image setup workflow](https://n8n.apexdentalautomation.com/workflow/dNCO3knZUlMlp3J7) | Inactive one-time TEST-1 workflow that records the centrally stored pilot image and provenance on the exact existing topic in BigQuery. It cannot email or publish. |
| [Exact pilot WordPress QA harness](https://n8n.apexdentalautomation.com/workflow/Tx59zEP3yH6nA6t4) | Inactive manual harness restricted to the existing Jake-only pilot article and WordPress post 9988. Running it updates that public test post, so it requires an immediate confirmation before each run. |
| [Prestonwood WordPress draft pilot](https://n8n.apexdentalautomation.com/workflow/x8P9o3fLDyDMxJ4s) | Inactive, manual-only credential/subsite check; [internal draft 9987](https://apexparent.hostmanpowered.com/dfw-03/wp-admin/post.php?post=9987&action=edit) was verified. It does not send email or enable real-site article publishing. |
| [Prestonwood approved-article pilot](PRESTONWOOD_APPROVED_ARTICLE_PILOT.md) | Exact-campaign, Jake-only test of interview through marketing approval and WordPress publishing; not a general dentist launch or a static-site release. |
| [Shortcoder field guide](SHORTCODER.md) | Verified practice shortcode names and publishing limits. |
| [WordPress article presentation](WORDPRESS_ARTICLE_PRESENTATION.md) | Bylines, verified doctor-profile mapping, featured-image provenance, FAQ rules, and rendered-QA status. |
| [Elementor MCP assessment](ELEMENTOR_MCP_ASSESSMENT.md) | Where Elementor MCP can help, and why per-article publishing remains deterministic REST automation. |
| [Project architecture](PROJECT_ARCHITECTURE.md) | System design and build direction. |
| [Known issues](KNOWN_ISSUES.md) | Documented low-priority interface and workflow issues. |

For a prompt change, follow the instructions in the prompt library. Editing a
Markdown file alone does not update a prompt embedded in a live n8n workflow.
