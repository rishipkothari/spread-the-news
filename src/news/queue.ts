import type { Category } from "@/lib/types";
import type { NewsStoryCard, Track } from "./types";

/**
 * "Play this section": voiced stories in rank order until the chosen length is filled.
 * A story that would go past the length by more than overflowSec is skipped and a shorter later one may fit.
 * Always returns at least one track when any story is voiced. Browser-safe (no config import): pass config.news.overflowSec.
 */
export function pickForLength(cards: NewsStoryCard[], minutes: number, overflowSec = 45): Track[] {
  const target = minutes * 60;
  const voiced = cards.filter((c) => c.track).sort((a, b) => a.rank - b.rank);
  const out: Track[] = [];
  let total = 0;
  for (const c of voiced) {
    const d = c.track!.durationSec;
    if (out.length && total + d > target + overflowSec) continue;
    out.push(c.track!);
    total += d;
    if (total >= target) break;
  }
  return out;
}

/** A section's rows (rank order kept from the day: voiced first). "all" = every story. */
export function sectionCards(cards: NewsStoryCard[], section: Category | "all"): NewsStoryCard[] {
  return section === "all" ? cards : cards.filter((c) => c.category === section);
}
