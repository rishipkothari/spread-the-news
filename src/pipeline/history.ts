import { config } from "@/lib/config";
import { getJson, paths, putJson } from "@/lib/storage";
import type { HistoryStory, Story } from "@/lib/types";

export async function readHistory(excludeDate?: string): Promise<HistoryStory[]> {
  const all = (await getJson<HistoryStory[]>(paths.history())) ?? [];
  return all.filter((h) => h.date !== excludeDate);
}

/** Replace `date`'s entries with this run's ranked stories and prune to the history depth. */
export async function updateHistory(date: string, stories: Story[]): Promise<void> {
  const cutoff = new Date(Date.parse(date) - config.historyDays * 86_400_000).toISOString().slice(0, 10);
  const prior = ((await getJson<HistoryStory[]>(paths.history())) ?? []).filter((h) => h.date !== date && h.date >= cutoff);
  const today: HistoryStory[] = stories.filter((s) => s.ranked).map((s) => ({ id: s.id, date, title: s.title, category: s.category }));
  await putJson(paths.history(), [...prior, ...today]);
}
