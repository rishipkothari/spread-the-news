import { z } from "zod";
import { CATEGORIES } from "@/lib/types";

export const VERDICTS = ["good", "too_high", "too_low", "merge", "mixed", "bad_category", "biased_title", "not_news"] as const;
export type Verdict = (typeof VERDICTS)[number];

export const VERDICT_LABEL: Record<Verdict, string> = {
  good: "✓ Good",
  too_high: "Ranked too high",
  too_low: "Ranked too low",
  merge: "Same story as another",
  mixed: "Mixes unrelated articles",
  bad_category: "Wrong category",
  biased_title: "Title not neutral",
  not_news: "Not a real headline",
};

export const StoryReview = z.object({
  verdicts: z.array(z.enum(VERDICTS)),
  mergeWith: z.string().max(100).optional(),
  category: z.enum(CATEGORIES).optional(),
  note: z.string().max(2000).optional(),
});
export type StoryReview = z.infer<typeof StoryReview>;

export const RunReview = z.object({
  runId: z.string(),
  savedAt: z.string().optional(),
  overall: z.number().int().min(0).max(5), // 0 = not rated
  missing: z.string().max(4000),
  notes: z.string().max(4000),
  stories: z.record(z.string(), StoryReview),
  shouldRank: z.array(z.string()), // ids of below-minimum stories that deserve a rank
});
export type RunReview = z.infer<typeof RunReview>;

export function emptyReview(runId: string): RunReview {
  return { runId, overall: 0, missing: "", notes: "", stories: {}, shouldRank: [] };
}
