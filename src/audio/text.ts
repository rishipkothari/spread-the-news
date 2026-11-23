/** Text preparation for text-to-speech. */

/** Split text into pieces of at most `maxChars`, at paragraph, then sentence, then word boundaries. */
export function splitForTts(text: string, maxChars: number): string[] {
  const clean = text.replace(/\r/g, "").trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];
  const sentences = clean
    .split(/\n\s*\n/)
    .flatMap((p) => p.replace(/\s+/g, " ").trim().match(/[^.!?]+(?:[.!?]+["'”’)\]]*|$)\s*/g) ?? [p])
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  let cur = "";
  const push = () => {
    if (cur) out.push(cur);
    cur = "";
  };
  for (const s of sentences) {
    if (s.length > maxChars) {
      push();
      // A single sentence longer than the limit: break between words.
      for (const w of s.split(" ")) {
        if (cur && cur.length + 1 + w.length > maxChars) push();
        cur = cur ? `${cur} ${w}` : w.slice(0, maxChars);
      }
      push();
      continue;
    }
    if (cur && cur.length + 1 + s.length > maxChars) push();
    cur = cur ? `${cur} ${s}` : s;
  }
  push();
  return out;
}

/** Escape text for an SSML document, so "&", "<" and quotes in a script can't break the request. */
export function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
