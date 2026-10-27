# Nicole's dashboard questions

This note tracks the answers and dashboard changes requested from Nicole's list.

## Answers and changes

1. **Invitation and review reminders.** Interview invitations do not currently get a follow-up reminder; links expire after 30 days unless a campaign deadline is set. Doctor review defaults to five calendar days. The active review-reminder workflow checks hourly and sends one reminder in the final 48 hours. A per-campaign option turns it off; older campaigns default to enabled.

2. **More than one provider at a practice chooses the same topic.** Each doctor keeps their own article; they do not need to choose a different topic or wait for another provider. The publisher checks for a WordPress slug already in use on that practice site. If it finds one from a different article, it adds a stable article-specific suffix and creates a separate post instead of updating the other doctor's article. Revisions continue to use the article's recorded WordPress post and URL.

3. **Invitation deadline.** The campaign builder now has an optional interview completion deadline. The invitation names the date, and the secure topic links expire at 11:59 PM Central that day. If no date is entered, links keep the 30-day lifetime. This does not promise the review or website release will be finished by that date.

4. **Training resource.** The campaign builder now has an optional HTTPS training or video URL. When entered, the invitation email includes it.

5. **Shared article details.** Articles for the same campaign topic already share that topic's featured image, alt text, and WordPress display date. Those values can differ between the campaign's three topics. Slugs remain unique where a practice site already has an article with that slug.

6. **Meta descriptions.** The writing workflow already generates and saves a meta description for each article. Descriptions can vary by article and topic; there is no manually maintained topic-level description field.

7. **Doctor status and CSV.** The dashboard already shows the current work stages and engagement. A fuller campaign CSV is prepared with each selected doctor's latest stage, interview timestamps, review deadline, and publication result. It includes `INVITED_NO_RESPONSE` for doctors who have not started; the dashboard release is still pending.

8. **Future publish date.** The WordPress workflow and campaign date field do not schedule a post for later. Approved articles are placed in WordPress automatically; the public/static website release is a separate manual step. Your team can handle timing during its WordPress review/release process, so future scheduling is not being added to the article automation.

9. **Doctor list order.** The campaign builder update adds sorting by last name, by practice then last name, or by first name; the dashboard release is still pending.

10. **Select and deselect all.** The campaign builder update adds “Select all shown” and “Deselect all.” Selecting all shown respects the current search and eligibility rules and retains the 200-doctor campaign limit; the dashboard release is still pending.

11. **Campaign archive and sorting.** The campaign history update adds sorting by month or name and filters for active or archived campaigns. Archive/restore is reversible and audited; archiving only changes dashboard history and does not stop work already in progress. The dashboard release is still pending.

12. **Updating the authoritative workbook.** The roster sync flows one way: from the workbook into the article system. Keep the workbook current as doctors join or leave; the system does not write its changes back to the sheet. Sync runs hourly, after which the dashboard can be refreshed. A new or changed practice website still needs a separate WordPress mapping and publishing setup.

## Rollout status

The invitation deadline/training-link changes, review-reminder setting, archive/restore router commands, and collision-safe WordPress publisher update have been saved in n8n. The review-reminder and router workflows remain active; the WordPress publisher remains inactive as before. The dashboard and Worker changes are prepared but not deployed because the Cloudflare login has expired. Do not tell Nicole that dashboard sorting, select/deselect all, CSV export, or dashboard archive controls are live until that release is deployed.
