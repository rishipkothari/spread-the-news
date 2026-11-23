import { config } from "@/lib/config";
import { CATEGORIES, type Category, type CategoryMix, type PlannedStory, type RunParams, type Story, type StorySynthesis } from "@/lib/types";
import type { EpisodePlanner, PlanInput } from "../types";

type Candidate = { story: Story; synthesis: StorySynthesis; rank: number };

/** Ordering strategies, chosen by RunParams.orderStrategy. Each returns the selected stories in episode order. */
export const ORDER_STRATEGIES: Record<string, (picked: Candidate[]) => Candidate[]> = {
  /** Straight rank order (the default). */
  rank: (picked) => [...picked].sort((a, b) => a.rank - b.rank),
  /** PRD option: top story first, then grouped by category (us, world, business, science, sports, other), ranked within. */
  "top-then-category": (picked) => {
    const sorted = [...picked].sort((a, b) => a.rank - b.rank);
    const [top, ...rest] = sorted;
    if (!top) return [];
    const order = (c: Category) => CATEGORIES.indexOf(c);
    return [top, ...rest.sort((a, b) => order(a.story.category) - order(b.story.category) || a.rank - b.rank)];
  },
};

function isMix(c: RunParams["categories"]): c is CategoryMix {
  return typeof c === "object" && !Array.isArray(c);
}

/**
 * Choose up to `max` candidates (already in rank order) honoring the profile's categories:
 * "all" → by rank; a list → only those categories; a mix → per-category quotas of `max`, then
 * top up from allowed categories by rank if quotas leave the episode short of `min`.
 */
export function selectStories(cands: Candidate[], categories: RunParams["categories"], min: number, max: number): { picked: Candidate[]; excluded: Map<string, string> } {
  const excluded = new Map<string, string>();
  if (categories === "all") return { picked: cands.slice(0, max), excluded };

  if (Array.isArray(categories)) {
    const allowed = new Set(categories);
    const ok = cands.filter((c) => {
      if (!allowed.has(c.story.category)) excluded.set(c.story.id, `category ${c.story.category} not in profile`);
      return allowed.has(c.story.category);
    });
    return { picked: ok.slice(0, max), excluded };
  }

  const mix = categories;
  const total = Object.values(mix).reduce((a, v) => a + (v ?? 0), 0) || 1;
  const quota = new Map<Category, number>(CATEGORIES.map((c) => [c, Math.round(((mix[c] ?? 0) / total) * max)]));
  const allowed = cands.filter((c) => {
    if (!mix[c.story.category]) excluded.set(c.story.id, `category ${c.story.category} has 0% in profile`);
    return !!mix[c.story.category];
  });
  const picked: Candidate[] = [];
  const used = new Map<Category, number>();
  for (const c of allowed) {
    if (picked.length >= max) break;
    const n = used.get(c.story.category) ?? 0;
    if (n < (quota.get(c.story.category) ?? 0)) {
      picked.push(c);
      used.set(c.story.category, n + 1);
    }
  }
  for (const c of allowed) {
    if (picked.length >= min || picked.length >= max) break;
    if (!picked.includes(c)) picked.push(c);
  }
  for (const c of allowed) if (!picked.includes(c)) excluded.set(c.story.id, `category ${c.story.category} quota full`);
  return { picked, excluded };
}

/** Lead gets leadWords, others storyWords; scaled down (not below minStoryWords) if that overflows the target. Never padded. */
export function wordBudgets(count: number, targetWords: number): number[] {
  const s = config.script;
  if (count === 0) return [];
  const want = [s.leadWords, ...Array(count - 1).fill(s.storyWords)] as number[];
  const room = targetWords - s.introOutroWords;
  const sum = want.reduce((a, b) => a + b, 0);
  const scale = sum > room ? room / sum : 1;
  return want.map((w) => Math.max(s.minStoryWords, Math.round((w * scale) / 10) * 10));
}

export const wordBudgetV1: EpisodePlanner = {
  id: "word-budget-v1",
  plan({ stories, syntheses, params }: PlanInput) {
    const synthBy = new Map(syntheses.map((s) => [s.storyId, s]));
    const skipped: { storyId: string; title: string; reason: string }[] = [];
    const cands: Candidate[] = [];
    let rank = 0;
    for (const story of stories) {
      if (!story.ranked) continue;
      rank++;
      const synthesis = synthBy.get(story.id);
      if (!synthesis) {
        skipped.push({ storyId: story.id, title: story.title, reason: "no synthesis (not analyzed, headlines only, or failed)" });
        continue;
      }
      if (synthesis.agreedFacts.length + (synthesis.singleSourceFacts?.length ?? 0) === 0) {
        skipped.push({ storyId: story.id, title: synthesis.title, reason: "synthesis has no facts" });
        continue;
      }
      cands.push({ story, synthesis, rank });
    }

    const min = params.storyCount?.min ?? config.vanilla.storyCount.min;
    const max = params.storyCount?.max ?? config.vanilla.storyCount.max;
    const { picked, excluded } = selectStories(cands, params.categories, min, max);
    for (const c of cands) {
      if (picked.includes(c)) continue;
      skipped.push({ storyId: c.story.id, title: c.synthesis.title, reason: excluded.get(c.story.id) ?? `over the ${max}-story limit` });
    }

    const orderStrategy = ORDER_STRATEGIES[params.orderStrategy] ? params.orderStrategy : "rank";
    const ordered = ORDER_STRATEGIES[orderStrategy](picked);
    const wordsPerMinute = config.script.wordsPerMinute;
    const targetWords = Math.round((params.targetDurationSec / 60) * wordsPerMinute);
    const budgets = wordBudgets(ordered.length, targetWords);
    const planned: PlannedStory[] = ordered.map((c, i) => ({
      storyId: c.story.id,
      title: c.synthesis.title,
      category: c.story.category,
      rank: c.rank,
      lead: i === 0,
      wordBudget: budgets[i],
    }));
    return {
      params,
      orderStrategy,
      wordsPerMinute,
      targetWords,
      plannedWords: budgets.reduce((a, b) => a + b, 0) + config.script.introOutroWords,
      stories: planned,
      skipped,
    };
  },
};
