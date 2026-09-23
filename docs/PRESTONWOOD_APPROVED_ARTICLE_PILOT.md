# Prestonwood approved-article pilot

This pilot exercises the existing test campaign through interview, article review,
marketing approval, and WordPress publishing on the Prestonwood editing site.
It does **not** activate the general-dentist campaign launcher or release the
Headless Hostman static site.

## Exact scope

- Campaign name: `AAC Prestonwood Pilot 2026-09-23`
- Campaign month: `2026-09`
- Derived campaign ID: `campaign_test_202609_aac_prestonwood_pilot_2026_09_23`
- Test recipient and both review roles: `jdold@apexdp.com` only.
- Existing test practice ID remains `practice_test_001` so the active test-only
  launcher and BigQuery safeguards remain in force. The publishing workflow
  routes **only this exact campaign and Jake's email** to the Prestonwood
  WordPress editing URL `https://apexparent.hostmanpowered.com/dfw-03/`.
- Writing and revision context use Prestonwood Family Dentistry and its public
  URL, `https://prestonwooddentistry.com`. This is a pilot exception, not a
  general doctor-to-practice mapping.

## Launch and observe

Use the [protected test launcher](https://n8n.apexdentalautomation.com/form/aac-test-campaign-launch).
Select only the `Test User` audience, TEST-1 practice, and Jake Dold. Enter the
exact campaign name and month above, three distinct topics, review the final
recipient list, then type `SEND TEST INVITATIONS`. The form submission should
be checked in the [launcher executions](https://n8n.apexdentalautomation.com/workflow/KvuBYWElqsvKx8lf/executions);
the form's generic submitted page alone is not proof that invitations queued.
Do not add real doctors to the `Test User` tab.

Jake must complete the voice interview, review the article, and approve the
marketing review. The first completed interview triggers drafting; a doctor
change request triggers revision and a fresh review link. Final marketing
approval invokes the [WordPress publisher](https://n8n.apexdentalautomation.com/workflow/kGd2YSJ2MVJwRld0)
with `publish` status. Confirm the resulting post in the DFW-03 WordPress
dashboard and the corresponding workflow execution. Do not trigger a static
site release as part of this pilot.

## Limits

The generic test publisher still targets TEST-1. This exception is intentionally
hard-coded to the one campaign ID, test practice, and test email; a different
campaign cannot silently publish to DFW-03. Full production rollout still
requires validated doctor-to-location relationships, approved recipient
routing, and separately verified WordPress access per location.
