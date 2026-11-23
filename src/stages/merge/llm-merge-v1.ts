import { z } from "zod";
import { config } from "@/lib/config";
import { sha } from "@/lib/hash";
import { structuredCall } from "@/lib/llm";
import type { Article, Source, Story } from "@/lib/types";
import type { MergeInput, MergeResult, StoryMerge, StoryMerger } from "../types";

export const MERGE_SYSTEM = `You check a list of news stories that were grouped from many outlets' articles, for a neutral daily news digest. The grouping was done in one pass and sometimes splits one news event into two or more stories: for example "Rep. X trails by 330 votes, requests recount" and a separate "Rep. X concedes House race", or "Storm makes landfall in Florida" and "Florida storm death toll rises to 12".

Find stories that should be one story:
- the same event reported under different headlines, or
- a direct follow-up of another story: a later development of the same specific event (a concession after a recount request, a verdict in a trial, a death toll update, an official's response to that exact event).

Do not merge:
- different events that share a theme, place, person or policy area (two separate court rulings about immigration; two different storms; a politician's two unrelated statements),
- a broad story with a narrower but distinct one (an election-night overview and one specific race are separate unless the race story is only a follow-up of a race the overview is about).

When in doubt, don't merge: a missed merge costs little, a wrong merge mixes two stories.

For each group return:
- stories: the story numbers (2 or more) that belong together.
- title: a short, neutral headline for the merged story that reflects the newest development (use the publish times).
- reason: one short sentence on why they're the same event.
Return an empty list when nothing should merge. A story may appear in at most one group.`;

export const MergeOutput = z.object({
  groups: z.array(z.object({ stories: z.array(z.number().int()), title: z.string(), reason: z.string() })),
});
export type MergeOutput = z.infer<typeof MergeOutput>;

const hhmm = (iso: string) => iso.slice(5, 16).replace("T", " ");

export function buildMergeUser(stories: Story[], articles: Map<string, Article>, sources: Map<string, Source>, maxHeadlines = 4): string {
  const lines = stories.map((s, i) => {
    const arts = s.articleIds.map((id) => articles.get(id)).filter((a): a is Article => !!a).sort((a, b) => (a.publishedAt < b.publishedAt ? -1 : 1));
    const outlets = new Set(arts.map((a) => a.sourceId)).size;
    const span = arts.length ? `${hhmm(arts[0].publishedAt)} → ${hhmm(arts[arts.length - 1].publishedAt)} UTC` : "";
    // Newest headlines first, one per outlet, so later developments are visible.
    const seen = new Set<string>();
    const heads: string[] = [];
    for (const a of [...arts].reverse()) {
      if (seen.has(a.sourceId) || heads.length >= maxHeadlines) continue;
      seen.add(a.sourceId);
      heads.push(`    ${hhmm(a.publishedAt)} ${sources.get(a.sourceId)?.name ?? a.sourceId}: ${a.title}`);
    }
    return [`${i + 1} | ${s.category} | ${outlets} outlets, ${arts.length} articles | ${span} | ${s.title}`, ...heads].join("\n");
  });
  return `STORIES (number | category | coverage | publish-time span | title, then newest headlines):\n${lines.join("\n")}`;
}

/** Apply the model's groups: validate numbers, keep each story in one group, merge articles into the largest story. */
export function applyMerges(out: MergeOutput, stories: Story[]): Omit<MergeResult, "usage"> {
  const warnings: string[] = [];
  const used = new Set<number>();
  const merges: StoryMerge[] = [];
  const absorbed = new Set<number>();
  const replaced = new Map<number, Story>();

  for (const g of out.groups) {
    const nums = [...new Set(g.stories)].filter((n) => {
      if (n < 1 || n > stories.length) warnings.push(`unknown story number ${n}`);
      else if (used.has(n)) warnings.push(`story ${n} in two groups; kept the first`);
      else return true;
      return false;
    });
    if (nums.length < 2) {
      if (g.stories.length >= 2) warnings.push(`group "${g.title}" left with fewer than 2 valid stories; skipped`);
      continue;
    }
    nums.forEach((n) => used.add(n));
    const group = nums.map((n) => stories[n - 1]).sort((a, b) => b.articleIds.length - a.articleIds.length);
    const primary = group[0];
    const articleIds = [...new Set(group.flatMap((s) => s.articleIds))];
    const merged: Story = {
      ...primary,
      id: `s-${sha([...articleIds].sort().join(","), 12)}`,
      title: g.title.trim() || primary.title,
      articleIds,
      continuesStoryId: primary.continuesStoryId ?? group.find((s) => s.continuesStoryId)?.continuesStoryId,
    };
    const primaryNum = stories.indexOf(primary) + 1;
    replaced.set(primaryNum, merged);
    nums.filter((n) => n !== primaryNum).forEach((n) => absorbed.add(n));
    merges.push({ into: merged.id, from: group.map((s) => s.id), titles: group.map((s) => s.title), title: merged.title, reason: g.reason.trim() });
  }

  const result = stories.flatMap((s, i) => (absorbed.has(i + 1) ? [] : [replaced.get(i + 1) ?? s]));
  return { stories: result, merges, warnings };
}

export const llmMergeV1: StoryMerger = {
  id: "llm-merge-v1",
  async merge({ stories, articles, sources }: MergeInput): Promise<MergeResult> {
    if (stories.length < 2) return { stories, merges: [], warnings: [], usage: [] };
    const { data, usage } = await structuredCall({
      model: config.models.merge,
      system: MERGE_SYSTEM,
      user: buildMergeUser(stories, new Map(articles.map((a) => [a.id, a])), new Map(sources.map((s) => [s.id, s]))),
      schema: MergeOutput,
      maxTokens: config.merge.maxTokens,
      effort: config.merge.effort as "low" | "medium" | "high",
    });
    return { ...applyMerges(data, stories), usage };
  },
};

/** Pass-through: switches the merge check off (`methods.merge: "none"`). */
export const noMerge: StoryMerger = {
  id: "none",
  merge: async ({ stories }) => ({ stories, merges: [], warnings: [], usage: [] }),
};
