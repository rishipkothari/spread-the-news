import { config } from "@/lib/config";
import { getJson, paths, putJson } from "@/lib/storage";
import type { HistoryStory, Story, StorySynthesis } from "@/lib/types";

export async function readHistory(excludeDate?: string): Promise<HistoryStory[]> {
  const all = (await getJson<HistoryStory[]>(paths.history())) ?? [];
  return all.filter((h) => h.date !== excludeDate);
}

/** Replace `date`'s entries with this run's ranked stories and prune to the history depth. */
export async function updateHistory(date: string, stories: Story[]): Promise<void> {
  const cutoff = new Date(Date.parse(date) - config.historyDays * 86_400_000).toISOString().slice(0, 10);
  const prior = ((await getJson<HistoryStory[]>(paths.history())) ?? []).filter((h) => h.date !== date && h.date >= cutoff);
  const existing = new Map(((await getJson<HistoryStory[]>(paths.history())) ?? []).filter((h) => h.date === date).map((h) => [h.id, h]));
  const today: HistoryStory[] = stories
    .filter((s) => s.ranked)
    .map((s) => ({
      id: s.id,
      date,
      title: s.title,
      category: s.category,
      ...(s.continuesStoryId ? { continuesStoryId: s.continuesStoryId } : {}),
      ...(existing.get(s.id)?.summary ? { summary: existing.get(s.id)!.summary } : {}),
    }));
  await putJson(paths.history(), [...prior, ...today]);
}

/** Store synthesis summaries on history entries (adds entries for stories missing from the index). */
export async function addHistorySummaries(date: string, stories: Story[], syntheses: StorySynthesis[]): Promise<void> {
  const all = (await getJson<HistoryStory[]>(paths.history())) ?? [];
  const byId = new Map(all.map((h) => [h.id, h]));
  for (const syn of syntheses) {
    const story = stories.find((s) => s.id === syn.storyId);
    const entry = byId.get(syn.storyId);
    if (entry) entry.summary = syn.summary;
    else if (story) {
      const h: HistoryStory = { id: story.id, date, title: syn.title, category: story.category, summary: syn.summary };
      if (story.continuesStoryId) h.continuesStoryId = story.continuesStoryId;
      all.push(h);
      byId.set(h.id, h);
    }
  }
  await putJson(paths.history(), all);
}

/** Walk continuesStoryId links back from a story; returns the chain oldest first. */
export function historyChain(startId: string | undefined, history: HistoryStory[], maxDepth = 10): HistoryStory[] {
  const byId = new Map(history.map((h) => [h.id, h]));
  const chain: HistoryStory[] = [];
  const seen = new Set<string>();
  let id = startId;
  while (id && !seen.has(id) && chain.length < maxDepth) {
    seen.add(id);
    const h = byId.get(id);
    if (!h) break;
    chain.unshift(h);
    id = h.continuesStoryId;
  }
  return chain;
}
