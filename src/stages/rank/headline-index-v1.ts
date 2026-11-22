import { config } from "@/lib/config";
import type { Article, LeanGroup, Source, SourceHealth, Story, StorySignals } from "@/lib/types";
import type { RankInput, StoryRanker } from "../types";

export type RankingConfig = typeof config.ranking;

export function leanGroup(leanValue: number): LeanGroup {
  return leanValue < 0 ? "left" : leanValue > 0 ? "right" : "center";
}

/** Normalized Shannon entropy of non-negative shares over `n` buckets. */
export function normalizedEntropy(shares: number[]): number {
  const n = shares.length;
  const total = shares.reduce((a, b) => a + b, 0);
  if (n < 2 || total <= 0) return 0;
  let h = 0;
  for (const s of shares) {
    const p = s / total;
    if (p > 0) h -= p * Math.log(p);
  }
  return h / Math.log(n);
}

export function computeSignals(
  story: Story,
  articlesById: Map<string, Article>,
  sourcesById: Map<string, Source>,
  activeSourceIds: Set<string>,
  windowEnd: string,
  rc: RankingConfig,
): StorySignals {
  const arts = story.articleIds.map((id) => articlesById.get(id)).filter((a): a is Article => !!a && activeSourceIds.has(a.sourceId));

  // Per-outlet weight: 1 if any non-opinion article, else opinionWeight.
  const outletWeight = new Map<string, number>();
  const outletTop = new Map<string, boolean>();
  for (const a of arts) {
    const w = a.articleType === "opinion" ? rc.opinionWeight : 1;
    outletWeight.set(a.sourceId, Math.max(outletWeight.get(a.sourceId) ?? 0, w));
    outletTop.set(a.sourceId, (outletTop.get(a.sourceId) ?? false) || a.prominence === "top");
  }
  const outletCount = [...outletWeight.values()].reduce((a, b) => a + b, 0);
  const coverage = activeSourceIds.size ? outletCount / activeSourceIds.size : 0;

  // Balance: per-group coverage share, normalized entropy across groups that have active outlets.
  const groups: LeanGroup[] = ["left", "center", "right"];
  const activeByGroup: Record<LeanGroup, number> = { left: 0, center: 0, right: 0 };
  for (const id of activeSourceIds) {
    const s = sourcesById.get(id);
    if (s) activeByGroup[leanGroup(s.leanValue)]++;
  }
  const coverByGroup: Record<LeanGroup, number> = { left: 0, center: 0, right: 0 };
  for (const [id, w] of outletWeight) coverByGroup[leanGroup(sourcesById.get(id)!.leanValue)] += w;
  const presentGroups = groups.filter((g) => activeByGroup[g] > 0);
  const balance = normalizedEntropy(presentGroups.map((g) => coverByGroup[g] / activeByGroup[g]));

  // Prominence: among covering outlets that have a top-stories feed, share that carried it there.
  const withTopFeed = [...outletWeight.keys()].filter((id) => sourcesById.get(id)?.feeds.some((f) => f.prominence === "top"));
  const prominence = withTopFeed.length ? withTopFeed.filter((id) => outletTop.get(id)).length / withTopFeed.length : 0;

  // Skew: |article-weighted mean lean| / 2, opinion weighted down.
  let wSum = 0;
  let leanSum = 0;
  for (const a of arts) {
    const w = a.articleType === "opinion" ? rc.opinionWeight : 1;
    wSum += w;
    leanSum += w * sourcesById.get(a.sourceId)!.leanValue;
  }
  const skew = wSum ? Math.min(1, Math.abs(leanSum / wSum) / 2) : 0;

  const times = arts.map((a) => a.publishedAt).sort();
  const firstSeen = times[0] ?? windowEnd;
  const lastSeen = times[times.length - 1] ?? windowEnd;
  const hours = Math.max(0, (Date.parse(windowEnd) - Date.parse(lastSeen)) / 3_600_000);
  const recency = Math.pow(0.5, hours / rc.recencyHalfLifeHours);

  return {
    outletCount,
    distinctOutlets: outletWeight.size,
    coverage,
    balance,
    skew,
    prominence,
    recency,
    firstSeen,
    lastSeen,
    leanMix: coverByGroup,
  };
}

export function headlineIndex(s: StorySignals, rc: RankingConfig): number {
  const { coverage, balance, prominence } = rc.weights;
  return (coverage * s.coverage + balance * s.balance + prominence * s.prominence) * (1 - rc.skewPenalty * s.skew) * s.recency;
}

export function activeSources(sourceHealth: SourceHealth): Set<string> {
  return new Set(Object.entries(sourceHealth).filter(([, h]) => h.ok).map(([id]) => id));
}

export function rankStories(input: RankInput, rc: RankingConfig = config.ranking): Story[] {
  const articlesById = new Map(input.articles.map((a) => [a.id, a]));
  const sourcesById = new Map(input.sources.map((s) => [s.id, s]));
  const active = activeSources(input.sourceHealth);
  const scored = input.stories.map((story) => {
    const signals = computeSignals(story, articlesById, sourcesById, active, input.windowEnd, rc);
    const ranked = signals.distinctOutlets >= rc.minOutlets;
    return { ...story, signals, ranked, headlineIndex: ranked ? round(headlineIndex(signals, rc)) : 0 };
  });
  return scored.sort((a, b) => Number(b.ranked) - Number(a.ranked) || b.headlineIndex - a.headlineIndex);
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export const headlineIndexV1: StoryRanker = {
  id: "headline-index-v1",
  rank: (input) => rankStories(input),
};
