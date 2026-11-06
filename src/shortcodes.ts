// Website fields (Shortcoder tags) in article drafts, such as [sc name="practice_name"][/sc]. The practice website fills
// them in when the page is published; review pages show a readable label instead of the raw code.
export const SHORTCODE_PATTERN = /\[(?:sc|hh_short)\s+name=["“”']?([A-Za-z0-9_]+)["“”']?\s*\](?:\s*\[\/sc\])?/gi;

const FIELD_LABELS: Record<string, string> = {
  practice_name: 'Practice name',
  practice_city_and_state: 'City, State',
  practice_city: 'City',
  practice_address: 'Practice address',
  practice_phone_number: 'Phone number',
  practice_email: 'Practice email',
  doctor_01: 'Doctor name',
};

export function shortcodeLabel(name: string): string {
  const known = FIELD_LABELS[name.toLowerCase()];
  if (known) return known;
  const words = name.replace(/^practice_/i, '').replace(/_/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Website field';
}

export const SHORTCODE_NOTE = 'Highlighted labels such as [Practice name] are website fields. The practice website fills them in automatically when the article is published.';

// Replaces website fields inside text nodes with a highlighted label (for already-sanitized HTML in the page).
export function labelShortcodesInDom(root: Node, ownerDocument: Document): number {
  const walker = ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
  let count = 0;
  for (const node of textNodes) {
    const text = node.nodeValue ?? '';
    SHORTCODE_PATTERN.lastIndex = 0;
    if (!SHORTCODE_PATTERN.test(text)) continue;
    SHORTCODE_PATTERN.lastIndex = 0;
    const fragment = ownerDocument.createDocumentFragment();
    let last = 0;
    for (const match of text.matchAll(SHORTCODE_PATTERN)) {
      const at = match.index ?? 0;
      if (at > last) fragment.append(text.slice(last, at));
      const label = ownerDocument.createElement('span');
      label.className = 'shortcode-field';
      label.title = `Website field: ${match[0]}`;
      label.textContent = `[${shortcodeLabel(match[1])}]`;
      fragment.append(label);
      last = at + match[0].length;
      count += 1;
    }
    if (last < text.length) fragment.append(text.slice(last));
    node.replaceWith(fragment);
  }
  return count;
}

// Same idea for raw article HTML shown in the dashboard's sandboxed preview (inline style, no page CSS there).
export function labelShortcodesInHtml(html: string): string {
  return html.replace(SHORTCODE_PATTERN, (_match, name: string) =>
    `<span style="background:#e8f4fa;border:1px dashed #0092c9;border-radius:4px;padding:0 0.3em;color:#064c78;white-space:nowrap">[${shortcodeLabel(name)}]</span>`);
}
