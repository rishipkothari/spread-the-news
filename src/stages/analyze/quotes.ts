/**
 * Verbatim-quote checking. Facts are only useful to the checker (Phase 2) if their quote can be found
 * in the article text, so quotes are normalized (case, whitespace, curly quotes, dashes) and searched.
 */
export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when `quote` appears in `text` after normalization (ellipses in the quote match any gap). */
export function quoteInText(quote: string, text: string): boolean {
  const q = normalizeForMatch(quote).replace(/^["']|["']$/g, "");
  if (q.length < 12) return false;
  const t = normalizeForMatch(text);
  if (t.includes(q)) return true;
  // "first part ... second part": each piece must appear, in order.
  const parts = q.split(/\s*(?:\.\.\.|\[\.\.\.\])\s*/).filter((p) => p.length >= 8);
  if (parts.length < 2) return false;
  let from = 0;
  for (const p of parts) {
    const i = t.indexOf(p, from);
    if (i < 0) return false;
    from = i + p.length;
  }
  return true;
}
