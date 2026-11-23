/** HTTP Range handling for audio playback. Phones' audio players need byte ranges (206) to play and seek. */

export interface ByteRange {
  start: number;
  end: number; // inclusive
}

/**
 * The range to serve for a `Range` header on a file of `size` bytes, capped at `maxBytes`
 * (players accept a shorter range than they asked for and request the rest).
 * No header → the first `maxBytes`. Returns null for a range that can't be satisfied.
 */
export function pickRange(header: string | null, size: number, maxBytes: number): ByteRange | null {
  if (size <= 0) return null;
  const cap = (start: number, end: number) => ({ start, end: Math.min(end, start + maxBytes - 1, size - 1) });
  if (!header) return cap(0, size - 1);
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.split(",")[0].trim());
  if (!m || (m[1] === "" && m[2] === "")) return null;
  if (m[1] === "") {
    // Suffix range: the last N bytes.
    const n = Number(m[2]);
    if (n <= 0) return null;
    return cap(Math.max(0, size - n), size - 1);
  }
  const start = Number(m[1]);
  const end = m[2] === "" ? size - 1 : Number(m[2]);
  if (start >= size || end < start) return null;
  return cap(start, end);
}

/** Only voiced audio and episodes may be served, never JSON or anything outside these folders. */
export function isServableAudioPath(path: string): boolean {
  return /^(audio|episodes)\/[A-Za-z0-9._-]+\.mp3$/.test(path);
}
