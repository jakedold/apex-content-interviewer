# Nicole's dashboard questions and outcomes

This note records the answers and changes in the recovered dashboard source.

## Answers and changes

1. **Invitation and review reminders.** Interview invitations do not have a
   follow-up reminder. Links last 30 days unless a campaign has an interview
   deadline. Doctor review defaults to five calendar days; the active reminder
   workflow checks hourly and sends one reminder in the final 48 hours. The
   campaign builder can turn that review reminder off. Existing campaigns
   without the setting continue to receive it.

2. **More than one provider at a practice chooses the same topic.** This is
   supported. Each doctor has a separate interview link and article. The
   WordPress publisher checks for an existing slug on that practice site and
   gives a different article an article-specific slug, so one doctor's article
   is not overwritten. Doctors are not blocked from choosing the same topic.

3. **Invitation deadline.** The campaign builder has an optional interview
   completion deadline. The invitation names the date, and topic links expire
   at 11:59 PM Central on that date. Without a deadline, links retain their
   30-day lifetime. This deadline does not promise that review or publishing
   will finish by then.

4. **Training resource.** The campaign builder accepts an optional HTTPS
   training or video link and includes it in the invitation email when set.

5. **Shared article details.** The campaign topic stores the featured image,
   alt text, and image source details shared by doctors who choose that topic.
   Article slugs remain article-specific and are made unique when needed on a
   practice site. The campaign builder does not set a future WordPress
   publication date.

6. **Meta descriptions.** The writing workflow generates and saves a
   meta-description for each article. Descriptions can vary by article and
   topic; the campaign builder does not maintain one description per topic.

7. **Doctor status and CSV.** The dashboard shows current work stages and
   engagement. Each campaign has a status CSV with doctor, practice, topic,
   current status, invitation/interview timestamps, review deadlines, article
   version, and publication result. Doctors who have not started appear in the
   export with their current invitation status.

8. **Future publish date.** No future-date field was added to the campaign
   builder. The current WordPress publisher workflow sends posts with status
   `publish` and rejects a future `wordpress_publish_date`, so this exported
   workflow does not itself provide a manual scheduling window. Nicole's
   preferred process is to manage future timing in WordPress; confirm the
   WordPress handoff is a draft/manual step before relying on that process.

9. **Doctor list order.** The campaign builder can sort doctors by last name,
   practice then last name, or first name.

10. **Select and deselect all.** The campaign builder has “Select all shown”
    and “Deselect all.” Select-all follows the current search and eligibility
    filters and keeps the 200-doctor campaign limit.

11. **Campaign archive and sorting.** Campaign history has current/unarchived
    and archived views, sort by month or campaign name, and reversible archive
    and restore actions. Archive only changes dashboard history; it does not
    stop invitations, interviews, reviews, or publishing. Archive and restore
    are administrator-only and audited.

12. **Updating the authoritative workbook.** The roster sync is one-way and
    hourly from the workbook into the article system. Keep the workbook current
    as doctors join or leave, then allow the sync to run and refresh the
    dashboard. Updates are not written back to the workbook. A new or changed
    practice website also needs its own WordPress mapping and publishing setup.

## Source and rollout status

The recovered dashboard source is commit `442da43`, deployed as Cloudflare
Worker version `052032d8`. The later Worker version `adac71e9` changed the
`ADMIN_ACTION_EMAILS` setting only. This recovery adds the missing source to
GitHub; it does not make another Cloudflare or n8n deployment.

The current live exports for workflows AAC-02, AAC-15, AAC-16, AAC-17, and
AAC-24 are included with credential bindings removed. AAC-02, AAC-17, and
AAC-24 are active in n8n; AAC-15 and AAC-16 are called as sub-workflows. Review
the future-publication behavior in AAC-15 before relying on WordPress manual
scheduling, as described in item 8.
