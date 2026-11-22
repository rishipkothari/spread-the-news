import { config } from "@/lib/config";
import { getJson, paths, putJson } from "@/lib/storage";
import type { Article, Source, SourceHealth, Story, StoryBundle, UsageEntry } from "@/lib/types";
import { impls, type Methods } from "@/stages/registry";
import type { TimeWindow } from "@/stages/types";
import { readHistory, updateHistory } from "./history";
import { STAGES, type FanoutStage, type StageId } from "./stages";
import { appendUsage, readStatus, updateStatus } from "./status";

interface SourcesOut { sources: Source[] }
interface FetchOut { window: TimeWindow; articles: Article[]; sourceHealth: SourceHealth }
interface ClusterOut { stories: Story[]; articleTypes: Record<string, Article["articleType"]>; warnings: string[]; historyCount: number }
interface RankOut { stories: Story[] }

async function need<T>(runId: string, stage: StageId): Promise<T> {
  const v = await getJson<T>(paths.stage(runId, stage));
  if (!v) throw new Error(`run ${runId} has no saved output for stage "${stage}"`);
  return v;
}

type StageFn = (runId: string, methods: Methods) => Promise<{ summary: Record<string, unknown>; usage: Omit<UsageEntry, "stage" | "ms">[] }>;

const runners: Record<Exclude<StageId, FanoutStage>, StageFn> = {
  async sources(runId, m) {
    const sources = await impls.sources(m).getSources();
    await putJson(paths.stage(runId, "sources"), { sources } satisfies SourcesOut);
    return { summary: { sources: sources.length }, usage: [] };
  },

  async fetch(runId, m) {
    const { sources } = await need<SourcesOut>(runId, "sources");
    const end = new Date();
    const window = { start: new Date(end.getTime() - config.fetch.windowHours * 3_600_000).toISOString(), end: end.toISOString() };
    const { articles, sourceHealth } = await impls.fetch(m).fetch(sources, window);
    await putJson(paths.stage(runId, "fetch"), { window, articles, sourceHealth } satisfies FetchOut);
    const okSources = Object.values(sourceHealth).filter((h) => h.ok).length;
    return { summary: { articles: articles.length, okSources, totalSources: sources.length }, usage: [] };
  },

  async cluster(runId, m) {
    const [{ sources }, fetched] = await Promise.all([need<SourcesOut>(runId, "sources"), need<FetchOut>(runId, "fetch")]);
    const active = new Set(Object.entries(fetched.sourceHealth).filter(([, h]) => h.ok).map(([id]) => id));
    const articles = fetched.articles.filter((a) => active.has(a.sourceId));
    const history = await readHistory(fetched.window.end.slice(0, 10));
    const result = await impls.cluster(m).cluster({ articles, sources, history });
    await putJson(paths.stage(runId, "cluster"), {
      stories: result.stories,
      articleTypes: result.articleTypes,
      warnings: result.warnings,
      historyCount: history.length,
    } satisfies ClusterOut);
    return {
      summary: { stories: result.stories.length, warnings: result.warnings.length, linked: result.stories.filter((s) => s.continuesStoryId).length },
      usage: result.usage,
    };
  },

  async rank(runId, m) {
    const [{ sources }, fetched, clustered, status] = await Promise.all([
      need<SourcesOut>(runId, "sources"),
      need<FetchOut>(runId, "fetch"),
      need<ClusterOut>(runId, "cluster"),
      readStatus(runId),
    ]);
    const articles = fetched.articles.map((a) => ({ ...a, articleType: clustered.articleTypes[a.id] ?? a.articleType }));
    const stories = impls.rank(m).rank({ stories: clustered.stories, articles, sources, sourceHealth: fetched.sourceHealth, windowEnd: fetched.window.end });
    await putJson(paths.stage(runId, "rank"), { stories } satisfies RankOut);

    const bundle: StoryBundle = {
      runId,
      createdAt: new Date().toISOString(),
      window: fetched.window,
      params: status!.params,
      methods: { ...m },
      sources,
      sourceHealth: fetched.sourceHealth,
      articles,
      stories,
    };
    await putJson(paths.bundle(runId), bundle);
    await updateHistory(fetched.window.end.slice(0, 10), stories);
    return { summary: { ranked: stories.filter((s) => s.ranked).length, top: stories[0]?.title }, usage: [] };
    // (Phase 1 stages run through src/pipeline/phase1.ts, one step per story.)
  },
};

/** Execute one stage against a run's saved inputs, recording status and usage. */
export async function runStage(runId: string, stage: Exclude<StageId, FanoutStage>): Promise<void> {
  const status = await updateStatus(runId, (s) => {
    s.state = "running";
    s.stages[stage] = { state: "running", startedAt: new Date().toISOString() };
  });
  const t0 = Date.now();
  const { summary, usage } = await runners[stage](runId, status.methods as Methods);
  const ms = Date.now() - t0;
  const entries: UsageEntry[] = usage.length ? usage.map((u, i) => ({ ...u, stage, ms: i === 0 ? ms : 0 })) : [{ stage, ms }];
  await appendUsage(runId, entries);
  await updateStatus(runId, (s) => {
    s.stages[stage] = { ...s.stages[stage]!, state: "done", finishedAt: new Date().toISOString(), summary };
  });
}

export async function markStageFailed(runId: string, stage: StageId, error: string): Promise<void> {
  await updateStatus(runId, (s) => {
    s.stages[stage] = { ...s.stages[stage], state: "failed", finishedAt: new Date().toISOString(), error };
    s.state = "failed";
    s.errors.push(`${stage}: ${error}`);
  });
}

export async function finishRun(runId: string): Promise<void> {
  await updateStatus(runId, (s) => {
    if (s.state !== "failed") s.state = "done";
    const fetchSummary = s.stages.fetch?.summary as { okSources?: number } | undefined;
    if (fetchSummary?.okSources != null && fetchSummary.okSources < config.failurePolicy.minSourcesOk) {
      s.errors.push(`only ${fetchSummary.okSources} sources returned data (policy minimum ${config.failurePolicy.minSourcesOk}); an episode would not be published`);
    }
  });
}

/** Copy saved stage outputs from an earlier run so a new run can start mid-pipeline. */
export async function copyStages(fromRunId: string, toRunId: string, stages: StageId[]): Promise<void> {
  for (const stage of stages) {
    const data = await getJson<unknown>(paths.stage(fromRunId, stage));
    if (!data) throw new Error(`replay source ${fromRunId} has no "${stage}" output`);
    await putJson(paths.stage(toRunId, stage), data);
  }
}

export function stagesBefore(stage: StageId): StageId[] {
  return STAGES.slice(0, STAGES.indexOf(stage));
}
