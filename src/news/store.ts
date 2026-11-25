import { getJson, listPaths, paths, putJson } from "@/lib/storage";
import type { Episode, EpisodeScript, StoryBundle } from "@/lib/types";
import type { SynthesizeOut } from "@/pipeline/phase1";
import type { AssembleOut, VoiceOut } from "@/pipeline/phase3";
import type { StageId } from "@/pipeline/stages";
import { buildNews, parsePublicStoryId, publicStoryId, type RunNewsInputs } from "./build";
import type { NewsDay, NewsIndex, NewsIndexEntry, NewsStory } from "./types";

/** Stages after which a run's news is rebuilt: the ranking, and the last stage of analysis, script and audio. */
export const NEWS_STAGES: StageId[] = ["rank", "synthesize", "script", "assemble"];

/** A run's saved output for the public pages (the active versions; working files are always the active version). */
export async function loadRunNews(runId: string): Promise<RunNewsInputs | null> {
  const [bundle, synth, script, voice, assemble] = await Promise.all([
    getJson<StoryBundle>(paths.bundle(runId)),
    getJson<SynthesizeOut>(paths.stage(runId, "synthesize")),
    getJson<EpisodeScript>(paths.stage(runId, "script")),
    getJson<VoiceOut>(paths.stage(runId, "voice")),
    getJson<AssembleOut>(paths.stage(runId, "assemble")),
  ]);
  if (!bundle) return null;
  const episode = assemble?.episodeId ? await getJson<Episode>(paths.episode(assemble.episodeId)) : null;
  return {
    bundle,
    ...(synth?.syntheses ? { syntheses: synth.syntheses } : {}),
    ...(script ? { script } : {}),
    ...(voice ? { voice } : {}),
    ...(episode ? { episode } : {}),
  };
}

export interface PublishResult {
  date: string;
  published: boolean;
  /** Why it wasn't published (another run of that day has more progress), or what replaced what. */
  note: string;
  stories: number;
  voiced: number;
}

/**
 * Make a run the published news of its day. Automatic publishing (after each news stage) only replaces the day's
 * current run when this one has at least as much progress (audio > script > analysis > ranking), so a later
 * ranking-only run doesn't hide a voiced day; `force` (the run page's "Publish to news") always replaces.
 */
export async function publishRun(runId: string, opts: { force?: boolean } = {}): Promise<PublishResult | null> {
  const input = await loadRunNews(runId);
  if (!input) return null;
  const { day, stories } = buildNews(input);
  const current = await getJson<NewsDay>(paths.newsDay(day.date));
  const base = { date: day.date, stories: day.counts.stories, voiced: day.counts.voiced };
  if (current && current.runId !== runId && !opts.force && current.progress > day.progress) {
    return { ...base, published: false, note: `kept run ${current.runId} (more progress)` };
  }
  for (let i = 0; i < stories.length; i += 8) await Promise.all(stories.slice(i, i + 8).map((s) => putJson(paths.newsStory(s.id), s)));
  await putJson(paths.newsDay(day.date), day);
  await updateIndex(day);
  return { ...base, published: true, note: current && current.runId !== runId ? `replaced run ${current.runId}` : "published" };
}

async function updateIndex(day: NewsDay): Promise<void> {
  const index = (await getJson<NewsIndex>(paths.newsIndex())) ?? { days: [] };
  const entry: NewsIndexEntry = { date: day.date, runId: day.runId, stories: day.counts.stories, voiced: day.counts.voiced, hasEpisode: !!day.episode, builtAt: day.builtAt };
  index.days = [...index.days.filter((d) => d.date !== day.date), entry].sort((a, b) => b.date.localeCompare(a.date));
  await putJson(paths.newsIndex(), index);
}

/** Called after every stage (src/workflows/steps.ts). Never throws: the news pages must not fail a pipeline stage. */
export async function publishAfterStage(runId: string, stage: StageId): Promise<void> {
  if (!NEWS_STAGES.includes(stage)) return;
  try {
    await publishRun(runId);
  } catch (e) {
    console.error(`news: publishing run ${runId} after ${stage} failed`, e);
  }
}

/** Rebuild every day from all runs that have a ranking (admin "Rebuild news"): per day, the run with the most progress, newest on a tie. */
export async function rebuildAllNews(): Promise<PublishResult[]> {
  const files = await listPaths("runs/", 100_000);
  const ids = [...new Set(files.filter((p) => /^runs\/[^/]+\/bundle\.json$/.test(p)).map((p) => p.split("/")[1]))].sort();
  const out: PublishResult[] = [];
  // Oldest first, so with equal progress the newest run of a day wins.
  for (const id of ids) {
    const r = await publishRun(id);
    if (r) out.push(r);
  }
  return out;
}

// ---------- reading (public pages) ----------

export async function readNewsIndex(): Promise<NewsIndex> {
  return (await getJson<NewsIndex>(paths.newsIndex())) ?? { days: [] };
}

export async function readNewsDay(date: string): Promise<NewsDay | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return getJson<NewsDay>(paths.newsDay(date));
}

/** A story page by public id (`{date}-{storyId}`). */
export async function readNewsStory(id: string): Promise<NewsStory | null> {
  const parsed = parsePublicStoryId(id);
  if (!parsed) return null;
  return getJson<NewsStory>(paths.newsStory(publicStoryId(parsed.date, parsed.storyId)));
}

/** The nearest published days before and after a date (for ‹ › and infinite scroll). The date itself needn't be published. */
export function dayNeighbours(index: NewsIndex, date: string): { older?: string; newer?: string } {
  const days = index.days.map((d) => d.date); // newest first
  return { older: days.find((d) => d < date), newer: days.filter((d) => d > date).at(-1) };
}
