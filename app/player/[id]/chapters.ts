import type { EpisodeChapter } from "@/lib/types";

/** The chapter playing at `t` seconds (pauses between chapters belong to the chapter before). */
export function chapterAt(chapters: EpisodeChapter[], t: number): EpisodeChapter | undefined {
  let cur: EpisodeChapter | undefined;
  for (const c of chapters) if (c.startSec <= t + 0.05) cur = c;
  return cur ?? chapters[0];
}

/** Start of the next chapter after `t`, or null at the last one. */
export function nextChapterStart(chapters: EpisodeChapter[], t: number): number | null {
  const n = chapters.find((c) => c.startSec > t + 0.5);
  return n ? n.startSec : null;
}

/** Like a CD player: more than 3 s into a chapter goes to its start, otherwise to the previous chapter. */
export function prevChapterStart(chapters: EpisodeChapter[], t: number): number {
  const cur = chapterAt(chapters, t);
  if (!cur) return 0;
  if (t - cur.startSec > 3) return cur.startSec;
  const i = chapters.indexOf(cur);
  return i > 0 ? chapters[i - 1].startSec : 0;
}

export { formatClock } from "@/audio/format";
