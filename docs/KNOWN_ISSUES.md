# Known issues and resolved observations

## Interview topic appears twice

- **Status:** Fixed in the application source and deployed to the TEST-1 Cloudflare Worker on September 23, 2026. Recheck visually on the next fresh interview.
- **Observed:** September 23, 2026, in the TEST-1 pilot interview for “Are two cleanings a year necessary?” The topic card showed the same question as both its large title and the smaller line beneath it.
- **Cause:** The interview page renders both `topic_title` and `topic_description` (`src/main.ts`). The campaign's topic 3 row stores the same question in both fields, confirmed in BigQuery. This is a display issue, not evidence that the interview transcript was duplicated.
- **Change:** The page now omits the smaller description when it is empty or repeats the title, while keeping the title visible. Existing interview data is unchanged.
