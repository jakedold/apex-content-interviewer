# Known issues

## Interview topic appears twice

- **Priority:** Low; display-only.
- **Observed:** September 23, 2026, in the TEST-1 pilot interview for “Are two cleanings a year necessary?” The topic card showed the same question as both its large title and the smaller line beneath it.
- **Cause:** The interview page renders both `topic_title` and `topic_description` (`src/main.ts`). The campaign's topic 3 row stores the same question in both fields, confirmed in BigQuery. This is a display issue, not evidence that the interview transcript was duplicated.
- **Follow-up:** When polishing the interview UI, omit the description line if it is empty or repeats the title. Keep the title visible. No urgent change is required for the test campaign.
