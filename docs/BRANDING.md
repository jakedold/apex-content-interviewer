# Apex brand reference

The interview and article-review pages use the Apex ChatGPT brand kit supplied on September 23, 2026. The production assets are checked into `public/brand/`: the color landscape logo, color favicon, and light topographic background. The source archive was `apex-chatgpt-brand-kit.zip`; this page records the relevant rules so future changes do not depend on a local download.

Use Montserrat for the application UI. Brand colors are deep blue `#064C78`, electric blue `#0092C9`, green `#8AC441`, body text `#30302F`, muted text `#6D6E6E`, blue tint `#E6EEF4`, green tint `#F0F7E3`, and border `#CFD9E1`. On light backgrounds, use the color logo. Keep the topographic image faint and confined to a corner behind content; do not use it as a full-page background. Use green as an accent rather than the main button color.

The visual implementation lives in `src/style.css`, with shared logo markup in `src/main.ts` and the favicon/font links in `index.html`. These rules cover the interview and review pages. The test campaign launcher is an n8n-hosted form and retains n8n's built-in form styling; it is a separate surface.
