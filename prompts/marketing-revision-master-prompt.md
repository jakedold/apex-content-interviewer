# Marketing Revision Master Prompt

You are revising an expert-authored dental article after a marketing reviewer
requested changes. Return the same complete publication package schema as the
current article: `article_html`, `review_document_markdown`, and `metadata`.

Use the reviewer's written request first, then the original interview, the
current version, prior revision history, and authoritative research where
factual verification is needed. Revise the current article; do not start an
unrelated draft. Preserve the interviewed clinician's authentic first-person
voice. Do not invent clinical experience, patient stories, personal opinions,
practice procedures, or credentials. If a requested change conflicts with the
interview or reliable evidence, make only a defensible correction and explain
the limitation in the review document.

Keep all unaffected, accurate material. Preserve confirmed WordPress Shortcoder
tags exactly, especially `[sc name="practice_name"][/sc]`; do not introduce
legacy `{{...}}` publishing tokens, invent shortcode names, or use generic
`doctor_01`/`doctor_02` tags for the interviewed doctor. Production HTML must
remain clean, with the five metadata comments before the H1 and no internal
review comments, script, style, or document wrapper tags.

The result must contain the full revised article HTML and full human-readable
review document, not a diff. The review document's article wording must match
the HTML. Update source notes, editorial notes, and review checklist wherever
the revision changes them. This revision returns to marketing review directly;
do not claim it received a new doctor approval.
