# Automated Article Creation System

## Project Purpose

Build an end-to-end automated content creation system for Apex Dental Partners that turns clinician expertise into high-quality, clinician-authored website articles with as little manual administrative work as possible.

The long-term workflow is:

**Monthly topic setup → doctor invitation → AI voice interview → transcript → article generation → doctor revision/approval → optional marketing approval → automated publishing**

The system should be designed as a reusable platform that can support many doctors, practices, websites, topics, and articles without requiring individual workflows to be manually rebuilt.

The existing SEO article-generation prompt and output package developed in this project should be reused as the article-generation layer rather than redesigned from scratch.

---

# 1. Core Technology Direction

The initial architecture should use:

- **n8n** for workflow orchestration
- **OpenAI** for the realtime voice interviewer and article-generation/revision models
- **Google BigQuery** as the primary system of record for workflow state, doctors, campaigns, interviews, articles, approvals, communication history, and publishing history
- **A lightweight custom web application** for the doctor interview and article-review experience
- **A communication adapter layer** capable of supporting email, SMS, and eventually Empower chat
- **WordPress** as the initial publishing target
- **Apex's future Astro website platform** as a future publishing target

n8n should orchestrate the process, but it should not itself serve as the permanent database or the doctor-facing user interface.

---

# 2. Architectural Principle: Event-Driven, Not One Giant Workflow

Do not build one enormous n8n execution that begins with the monthly invitation and remains open until an article is published.

Instead:

**BigQuery stores state. n8n responds to events and state changes.**

Examples:

- campaign.started
- invitation.sent
- interview.started
- interview.completed
- article.generated
- revision.requested
- doctor.approved
- doctor.auto_approved
- marketing.approved
- publish.requested
- article.published
- workflow.failed

Individual n8n workflows should perform discrete jobs.

This architecture should make the system:

- recoverable
- auditable
- easier to troubleshoot
- easier to modify
- easier to scale
- easier to migrate between publishing platforms

---

# 3. Initial Monthly Campaign Process

The initial version should remain deliberately simple.

Do **not** build automated topic selection or AI-driven topic assignment in V1.

Each month, an administrator will manually create a content campaign and define exactly three topics.

Example:

**September 2026 Campaign**

Topic 1  
Periodontal Disease

Topic 2  
Dental Implants

Topic 3  
Why Teeth Crack

Each topic may include additional interviewer guidance, desired areas of discussion, SEO considerations, or other relevant context.

Once the three topics and participating doctors have been entered, the administrator manually triggers the campaign.

n8n then generates and sends the doctor invitations.

More sophisticated topic personalization can be considered later.

---

# 4. Topic Selection Experience

For V1, doctors should ideally select their topic **before entering the voice interview**.

The invitation should present three topic choices.

Example:

> We have three article topics available this month. Choose whichever one you'd most like to discuss.

**Talk About Periodontal Disease**

**Talk About Dental Implants**

**Talk About Cracked Teeth**

Each option should have its own unique secure link.

Conceptually:

```text
content.apexdp.com/interview/{secure_token_for_topic_1}

content.apexdp.com/interview/{secure_token_for_topic_2}

content.apexdp.com/interview/{secure_token_for_topic_3}
```

The secure link should already identify:

- doctor
- practice
- campaign
- selected topic
- topic-specific interview guidance

Therefore, once the doctor clicks the link, the interview agent already knows exactly what topic it is interviewing the doctor about.

There should be no unnecessary topic-selection interaction inside the voice agent itself.

If future communication channels make three direct links awkward, a simple topic-selection landing page may be used, but separate topic-specific links are preferred for V1.

---

# 5. Doctor Communication Preferences

The system should support multiple communication channels.

Each doctor should eventually have a preferred communication method such as:

```text
email
sms
empower_chat
```

The system should allow the doctor to indicate how they prefer to receive future article requests and review notifications.

Example:

> How would you like us to send future article requests?

- Text message
- Email
- Empower chat

The selected preference should be stored in BigQuery.

The orchestration layer should not contain channel-specific logic throughout the entire workflow.

Instead, n8n should call a generalized function or sub-workflow conceptually equivalent to:

```text
SEND_DOCTOR_MESSAGE
```

That workflow determines the doctor's preferred communication channel and routes the message appropriately.

Conceptually:

```text
SEND_DOCTOR_MESSAGE
        |
        |-- email
        |
        |-- SMS
        |
        `-- Empower chat
```

### Empower

Empower chat integration is not required for the first working prototype.

However, the architecture should anticipate it.

If the Apex development team can expose an API or another supported method for creating Empower chat messages, an Empower communication adapter should be added without requiring the rest of the article system to change.

### Fallback

The data model should also permit a fallback communication channel in case a preferred method fails.

---

# 6. Doctor Interview Web Application

Doctors should not need a ChatGPT account.

They should click their secure invitation link and enter a simple Apex-branded browser experience.

The application should:

1. Validate the secure link.
2. Load the doctor and selected topic.
3. Explain briefly what will happen.
4. Request microphone permission.
5. Begin the realtime AI voice interview.
6. Conduct the interview conversationally.
7. Capture the transcript.
8. End the interview naturally.
9. Save the interview record.
10. Notify n8n that the interview has completed.
11. Display a simple completion message.

The application should be intentionally minimal.

---

# 7. Voice Interview Agent

The interview agent is a distinct AI agent.

Its purpose is **not** to write the article.

Its purpose is:

> Extract useful, distinctive, first-person subject-matter expertise from the clinician that can later be transformed into an authoritative article written from that clinician's perspective.

The agent should receive:

- doctor name
- doctor/practice context
- selected topic
- monthly campaign context
- topic-specific guidance
- interview objectives
- interview behavioral instructions

The interview should be conversational rather than a rigid questionnaire.

The agent should dynamically:

- ask follow-up questions
- clarify vague answers
- probe interesting comments
- ask for explanations a patient would understand
- uncover common misconceptions
- surface the doctor's own approach
- identify useful examples or analogies
- explore areas where the doctor's perspective differs from generic web content
- recognize when a subject has already been adequately covered

---

# 8. Interview Stopping Behavior

The interviewer prompt will require significant development and testing.

A particularly important requirement is **knowing when to stop**.

The agent should not continue asking questions merely because it is capable of generating another question.

The final prompt should define clear completion criteria.

The interview should end when the agent has enough substantive information to create the intended article.

Possible completion logic should evaluate whether the interview has captured enough of the following:

- the doctor's core explanation of the topic
- clinically important distinctions
- common patient misunderstandings
- recommendations or treatment philosophy
- useful examples or analogies
- questions patients frequently ask
- meaningful expertise not easily obtained from generic sources

The interviewer should not use a rigid question count as its sole stopping mechanism.

Instead, once sufficient coverage has been achieved, it should transition naturally toward closure.

A likely closing sequence is:

1. Briefly recognize that the major areas have been covered.
2. Ask one final question such as whether there is anything important the doctor wishes patients understood that has not yet been discussed.
3. Capture that response.
4. End the interview.

Target interview length can be tested during development, but the goal is to make the process efficient enough that doctors will participate regularly.

---

# 9. Transcript and Audio

The transcript is required.

The full conversation transcript should be retained and associated with the interview record.

Audio storage is desirable but **not required for V1**.

If audio storage can be implemented simply and inexpensively, retain the recording and store only its storage location and metadata in BigQuery.

Do not store large audio binary files directly in BigQuery.

Failure to store audio should never prevent the article workflow from continuing if a usable transcript exists.

---

# 10. BigQuery as the System of Record

Use BigQuery as the primary database for the initial system.

The design should favor clear event history and auditable state.

Potential logical tables include:

## doctors

```text
doctor_id
doctor_name
credentials
email
mobile_phone
preferred_communication_channel
fallback_communication_channel
practice_id
active
created_at
updated_at
```

## practices

```text
practice_id
practice_name
website_domain
publisher_type
publisher_config_reference
active
```

## campaigns

```text
campaign_id
campaign_name
campaign_month
status
doctor_review_days
require_marketing_approval
created_at
launched_at
```

## campaign_topics

```text
topic_id
campaign_id
topic_title
topic_description
interview_guidance
topic_sort_order
```

## campaign_doctors

```text
campaign_id
doctor_id
status
invited_at
```

## interview_links

```text
link_id
campaign_id
doctor_id
topic_id
secure_token_hash
expires_at
used_at
status
```

## interviews

```text
interview_id
campaign_id
doctor_id
topic_id
status
started_at
completed_at
transcript
audio_storage_uri
interview_metadata
```

## articles

```text
article_id
interview_id
doctor_id
practice_id
campaign_id
status
current_version
created_at
doctor_review_deadline
doctor_approved_at
marketing_approved_at
published_at
published_url
```

## article_versions

```text
article_id
version_number
version_type
content
revision_instruction
created_at
created_by
```

Possible version types:

```text
AI_INITIAL_DRAFT
AI_DOCTOR_REVISION
DOCTOR_EDIT
MARKETING_EDIT
FINAL_APPROVED
```

## communications

```text
communication_id
doctor_id
article_id
campaign_id
communication_type
channel
recipient
status
sent_at
delivered_at
provider_message_id
```

## approvals

```text
approval_id
article_id
approval_type
status
requested_at
deadline
responded_at
response
```

## workflow_events

```text
event_id
entity_type
entity_id
event_type
event_timestamp
payload
workflow_execution_id
```

The exact schema can evolve as implementation begins.

---

# 11. Article Generation

When an interview is completed, n8n should trigger article generation.

Inputs should include:

- interview transcript
- doctor information
- practice information
- selected topic
- existing SEO article-generation prompt
- applicable campaign context
- website context
- any structured publishing requirements

The article-writing model should return structured output rather than unstructured prose wherever practical.

The existing SEO article-generation prompt developed in this project should serve as the primary generation specification.

The output should support both:

- human review
- automated publishing

The article-generation layer should remain separate from the interview-agent layer.

---

# 12. Doctor Review

When the first article draft is ready, the doctor should receive a message through their preferred communication channel.

The message should include:

- a secure article-review link
- a clear statement that they may approve or request changes
- the exact review deadline
- notice that the article will automatically be considered approved if no response is received by the deadline

Default doctor review period:

**5 calendar days**

This value should be configurable at the campaign level.

Example:

> Your article is ready for review. You can approve it or request any changes using the link below. If we don't hear from you by September 23, the article will automatically move forward as approved.

---

# 13. Doctor Review Portal

The review link should open the same general Apex content web application used for interviews.

The doctor should see a clean human-readable rendering of the article.

Primary actions:

**Approve**

**Request Changes**

If Request Changes is selected, provide a simple feedback field.

Example:

> Tell us what you'd like changed.

The doctor should not need to edit HTML or work inside WordPress.

---

# 14. Article Revision

A revision request should trigger a dedicated article-revision workflow and prompt.

Inputs should include:

- original interview transcript
- current article version
- doctor's revision request
- prior revision history when relevant
- article-writing rules

The revision model should modify the existing article rather than regenerate an unrelated article from scratch.

Each revision should create a new article version.

Example:

```text
Version 1
Initial AI draft

Version 2
AI revision from doctor feedback

Version 3
Second doctor revision

Version 4
Marketing adjustment

Version 5
Final approved article
```

No prior version should be overwritten or lost.

After revision, the doctor should receive another review request.

This loop may repeat until approval.

---

# 15. Doctor Auto-Approval

Doctor review should never remain open indefinitely.

Each review request should have a deadline.

Default:

```text
5 days
```

If the doctor takes no action by the deadline:

```text
DOCTOR_REVIEW
        ↓
DOCTOR_AUTO_APPROVED
```

The system should record that this was an **automatic approval caused by expiration**, rather than a manual approval.

If marketing approval is required, the article should then move into marketing review.

If marketing approval is not required, it can move into the publishing workflow.

Optional reminder messages should be supported before expiration.

The exact reminder schedule can be determined during implementation.

---

# 16. Marketing Review

Initially, marketing review should be available as a final human quality-control step.

Campaign setting:

```text
require_marketing_approval = true | false
```

Initial recommended configuration:

```text
true
```

Once the system has proven reliable, some campaigns, practices, or doctors may be permitted to bypass this stage.

Marketing reviewers should be able to:

- review the final article
- approve it
- make or request changes
- prevent publication when necessary

Once marketing approval is complete, the article moves to publishing.

---

# 17. Future Conversational Article Review

Conversational voice-based article editing may be developed later.

Example:

Doctor:

> I don't like the third section. It makes it sound like every patient with gum disease needs scaling and root planing.

AI:

> It sounds like you'd like that section to make treatment dependent on the actual periodontal diagnosis. Is that correct?

Doctor:

> Yes.

The system could then produce the revision.

This is a Phase 2 capability and should not complicate V1.

---

# 18. Publishing Architecture

Publishing must be abstracted from the main workflow.

The main workflow should conceptually call:

```text
PUBLISH_ARTICLE
```

The publishing layer then determines the site's publishing platform.

```text
PUBLISH_ARTICLE
        |
        |-- WORDPRESS_PUBLISHER
        |
        `-- ASTRO_PUBLISHER
```

## Current state

WordPress

## Future state

Apex Astro website platform

The article-generation, interview, review, and approval workflows should not need to change when the website platform changes.

Only the publishing adapter should change.

---

# 19. n8n Workflow Structure

Do not create one enormous n8n workflow.

Prefer discrete, clearly named workflows or sub-workflows.

Likely examples:

```text
AAC - 01 - Launch Monthly Campaign

AAC - 02 - Create Topic Interview Links

AAC - 03 - Send Doctor Message

AAC - 04 - Interview Completed

AAC - 05 - Generate Article

AAC - 06 - Send Doctor Review

AAC - 07 - Process Revision Request

AAC - 08 - Doctor Approval Expiration

AAC - 09 - Marketing Review

AAC - 10 - Publish Article

AAC - 11 - Verify Publication

AAC - 12 - Error Handling and Retry
```

`AAC` = Automated Article Creation.

Names can be adjusted later, but workflow names should always make their purpose immediately obvious.

---

# 20. Workflow Status Model

Use explicit statuses rather than attempting to infer where something is in the process.

Possible article lifecycle:

```text
CAMPAIGN_READY
INVITED
INTERVIEW_STARTED
INTERVIEW_COMPLETED
GENERATING
DOCTOR_REVIEW
REVISION_REQUESTED
REVISING
DOCTOR_APPROVED
DOCTOR_AUTO_APPROVED
MARKETING_REVIEW
MARKETING_APPROVED
PUBLISHING
PUBLISHED
```

Exception states:

```text
INTERVIEW_ABANDONED
GENERATION_FAILED
COMMUNICATION_FAILED
PUBLISH_FAILED
ON_HOLD
REJECTED
```

Status naming should remain consistent across BigQuery, n8n, and the web application.

---

# 21. V1 Scope Discipline

The initial version should prioritize getting the entire basic pipeline working.

Do not add complexity simply because it may eventually be useful.

### Included in V1

- manually defined monthly campaign
- exactly three manually selected topics
- selected doctor list
- three topic-specific links
- email and/or another easily implemented communication method
- doctor communication preference architecture
- AI realtime voice interview
- transcript capture
- article generation
- doctor review
- written revision requests
- article revision
- five-day doctor auto-approval
- marketing approval
- WordPress publishing
- BigQuery event/state tracking
- error logging
- article version history

### Not required for initial V1

- AI-generated monthly topic strategy
- personalized topics for every doctor
- voice-based article revision
- mandatory audio storage
- Empower chat integration before an integration mechanism exists
- automated PHI policing/redaction layer
- advanced content performance optimization
- direct Astro publishing before the new platform is ready

---

# 22. n8n Development Rule: JSON First

The user does **not** want to manually construct n8n workflows node by node.

When building or modifying an n8n workflow, ChatGPT should architect the workflow and then provide a **complete importable n8n workflow JSON file** whenever reasonably possible.

The desired workflow is:

```text
Discuss architecture in ChatGPT
        ↓
Agree on workflow behavior
        ↓
ChatGPT generates complete workflow JSON
        ↓
User imports JSON into n8n
        ↓
User connects credentials or enters the small number of environment-specific values that cannot be preconfigured
        ↓
Test
        ↓
Revise JSON if necessary
```

Do not default to instructions such as:

> Add a Webhook node.  
> Now add a BigQuery node.  
> Connect it to an IF node.  
> Add another HTTP Request node.

That should only happen when there is a specific troubleshooting reason.

Instead, ChatGPT should do the workflow construction work.

---

# 23. Requirements for n8n JSON Deliverables

When producing an n8n workflow:

1. Produce the full workflow, not isolated node snippets, unless specifically troubleshooting one node.

2. Use clear human-readable node names.

Bad:

```text
HTTP Request1
Code2
IF3
```

Good:

```text
Load Campaign Doctors
Create Topic Links
Log Communication Attempt
Route Preferred Channel
Generate Article Draft
Mark Doctor Auto-Approved
```

3. Lay nodes out logically on the n8n canvas.

4. Use notes or sticky-note sections where they materially improve readability.

5. Keep related workflow sections visually grouped.

6. Prefer reusable sub-workflows when the same function appears in multiple places.

7. Use credential placeholders rather than embedding secrets.

8. Never include private API keys, passwords, tokens, or other secrets directly in workflow JSON.

9. Clearly identify any credential connections the user must select after import.

10. Clearly identify any environment-specific values that must be supplied, such as:
   - BigQuery project
   - dataset
   - table names
   - API endpoint URLs
   - credential selections
   - website IDs
   - communication provider configuration

11. Where possible, centralize configuration rather than repeating constants throughout multiple nodes.

12. Include error-handling paths.

13. Include useful execution logging.

14. Keep workflow naming consistent with this project's naming convention.

15. Before producing n8n-specific instructions or workflow JSON, verify current n8n behavior/documentation if node configuration or UI behavior may have changed.

16. Prefer a **complete revised JSON replacement** over telling the user to manually modify several nodes.

---

# 24. n8n Import Workflow

The preferred user-side interaction should be minimal.

Typically:

1. Download the JSON provided by ChatGPT.
2. Import the workflow into n8n.
3. Connect required credentials.
4. Update the small number of clearly marked configuration values.
5. Run a test.
6. Report the result back to ChatGPT.

Where possible, configuration that can safely be included in the JSON should already be included.

---

# 25. Implementation Instruction Style

The user strongly prefers **small, testable batches of steps**.

Do not provide a long sequence of UI instructions that assumes every earlier step works.

This is especially important for rapidly changing software interfaces such as:

- n8n
- OpenAI
- Google Cloud
- WordPress
- Cloudflare
- other development platforms

For implementation work, use the following pattern.

### Step Group

Provide a small group of related actions, generally around 1–4 actions.

Example:

```text
1. Import this workflow JSON.
2. Open the "BigQuery - Article State" node.
3. Select your existing BigQuery credential.
4. Save the workflow.
```

Then stop.

Allow the user to:

- confirm success
- provide the result
- provide an error
- send a screenshot

Only then proceed to the next meaningful step.

Do not provide twelve downstream instructions that depend on the first instruction working.

---

# 26. Current-UI Verification Rule

When giving instructions that depend on the current interface or capabilities of a platform, do not assume an older interface is still correct.

When appropriate:

1. Verify current official documentation.
2. Use the current UI terminology.
3. Avoid giving speculative click paths.
4. If the user's screenshot differs from expected behavior, treat the screenshot as the immediate source of truth and reassess before continuing.

The objective is to prevent the common failure pattern where instructions proceed several steps beyond the point where the real interface differs from the assumed interface.

---

# 27. Troubleshooting Style

When something fails:

- diagnose the current failure before proceeding
- do not repeat already completed setup unnecessarily
- ask for screenshots or output only when they materially help
- give copy-and-paste queries, commands, JSON, or code rather than vague instructions
- when replacing code or workflow configuration, prefer providing the complete replacement
- keep the user focused only on the next relevant problem

When a technical implementation has multiple dependencies, validate them sequentially rather than attempting to debug the entire stack at once.

---

# 28. Automation Philosophy

The goal of this project is not merely to automate article writing.

The goal is to automate the **entire operational process** around recurring expert content:

```text
Select topics
↓
Invite expert
↓
Capture expertise
↓
Create article
↓
Obtain approval
↓
Handle revisions
↓
Escalate when necessary
↓
Publish
↓
Record what happened
```

Human effort should be concentrated where human judgment is valuable.

Manual administrative work should be designed out of the process wherever practical.

---

# 29. Initial Development Milestone

Do not attempt to build the entire production platform at once.

The first major proof of concept should validate the hardest and most unique part of the system:

## Milestone 1: Voice Interview Vertical Slice

Build a working path that allows:

```text
Create test doctor/campaign/topic
↓
Generate secure topic-specific link
↓
Open interview webpage
↓
Start realtime AI voice interview
↓
Conduct topic-specific conversation
↓
Agent ends interview appropriately
↓
Save complete transcript
↓
Record interview completion in BigQuery
```

For this milestone:

- no article generation is necessary yet
- no doctor approval is necessary yet
- no WordPress publishing is necessary yet
- audio storage is optional

The milestone is successful when a real user can complete a voice interview and the system reliably captures a useful transcript tied to the correct doctor, campaign, and topic.

Once this works well, build the next vertical slice.

---

# 30. Planned Development Sequence

The current recommended order is:

## Phase 1A
Data model and BigQuery foundation

## Phase 1B
Secure topic-specific interview links

## Phase 1C
Realtime voice interviewer

## Phase 1D
Transcript persistence and interview completion event

## Phase 1E
Article-generation workflow using the existing SEO article prompt

## Phase 1F
Doctor review portal

## Phase 1G
Revision loop

## Phase 1H
Five-day auto-approval

## Phase 1I
Marketing review

## Phase 1J
WordPress publishing

## Phase 1K
Communication preference routing and reminders

## Phase 2+
- Empower chat adapter
- voice-based revisions
- more advanced topic intelligence
- automated content planning
- Astro publishing adapter
- performance feedback loops
- other improvements based on actual usage

---

# 31. Guiding Principle for Future Decisions

When deciding between a sophisticated architecture and a simpler design, favor the simplest solution that:

- supports the intended long-term architecture
- avoids obvious future rework
- is reliable
- is auditable
- can be automated
- minimizes repetitive human administration

Do not build Phase 3 functionality into Phase 1 merely because it might eventually be useful.

Build the smallest durable version of the system, validate it with real doctors, and expand based on actual experience.