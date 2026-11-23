import { config } from "@/lib/config";
import { getJson, paths, putJson } from "@/lib/storage";
import type { Article, EpisodePlan, Source, SourceHealth, Story, StoryBundle, UsageEntry } from "@/lib/types";
import { impls, type Methods } from "@/stages/registry";
import type { StoryMerge, TimeWindow } from "@/stages/types";
import { readHistory, updateHistory } from "./history";
import { assembleEpisode } from "./phase3";
import type { AnalysisPlan, SynthesizeOut } from "./phase1";
import { STAGES, type FanoutStage, type StageId } from "./stages";
import { appendUsage, readStatus, updateStatus } from "./status";

interface SourcesOut { sources: Source[] }
interface FetchOut { window: TimeWindow; articles: Article[]; sourceHealth: SourceHealth }
interface ClusterOut { stories: Story[]; articleTypes: Record<string, Article["articleType"]>; warnings: string[]; historyCount: number }
export interface MergeOut { stories: Story[]; merges: StoryMerge[]; warnings: string[] }
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

  /** Join stories the clusterer split: the same event, or a direct follow-up of another (one cheap call). */
  async merge(runId, m) {
    const [{ sources }, fetched, clustered] = await Promise.all([need<SourcesOut>(runId, "sources"), need<FetchOut>(runId, "fetch"), need<ClusterOut>(runId, "cluster")]);
    const result = await impls.merge(m).merge({ stories: clustered.stories, articles: fetched.articles, sources });
    await putJson(paths.stage(runId, "merge"), { stories: result.stories, merges: result.merges, warnings: result.warnings } satisfies MergeOut);
    return {
      summary: { merges: result.merges.length, storiesBefore: clustered.stories.length, storiesAfter: result.stories.length, warnings: result.warnings.length },
      usage: result.usage,
    };
  },

  async rank(runId, m) {
    const [{ sources }, fetched, clustered, merged, status] = await Promise.all([
      need<SourcesOut>(runId, "sources"),
      need<FetchOut>(runId, "fetch"),
      need<ClusterOut>(runId, "cluster"),
      getJson<MergeOut>(paths.stage(runId, "merge")),
      readStatus(runId),
    ]);
    const articles = fetched.articles.map((a) => ({ ...a, articleType: clustered.articleTypes[a.id] ?? a.articleType }));
    // Runs from before the merge check (or with it skipped) rank the clustered stories directly.
    const stories = impls.rank(m).rank({ stories: merged?.stories ?? clustered.stories, articles, sources, sourceHealth: fetched.sourceHealth, windowEnd: fetched.window.end });
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

  /** Phase 2: pick and order the episode's stories from the synthesized ones, with word budgets. */
  async plan(runId, m) {
    const [bundle, synth, status, analysisPlan] = await Promise.all([
      getJson<StoryBundle>(paths.bundle(runId)),
      getJson<SynthesizeOut>(paths.stage(runId, "synthesize")),
      readStatus(runId),
      getJson<AnalysisPlan>(paths.analysisPlan(runId)),
    ]);
    if (!bundle) throw new Error(`run ${runId} has no ranked bundle`);
    if (!synth) throw new Error(`run ${runId} has no synthesis; run analysis first`);
    const planner = impls.plan(m);
    const plan: EpisodePlan = { planner: planner.id, ...planner.plan({
      stories: bundle.stories,
      syntheses: synth.syntheses,
      params: status!.params,
      analysis: {
        analyzedIds: analysisPlan?.storyIds ?? [],
        headlinesOnly: synth.skipped ?? [],
        errors: Object.fromEntries(synth.errors.map((e) => [e.slice(0, e.indexOf(": ")), e.slice(e.indexOf(": ") + 2)])),
      },
    }) };
    await putJson(paths.stage(runId, "plan"), plan);
    return {
      summary: { stories: plan.stories.length, skipped: plan.skipped.length, order: plan.orderStrategy, plannedMin: +(plan.plannedWords / plan.wordsPerMinute).toFixed(1) },
      usage: [],
    };
  },

  /** Phase 3: join the voiced segments into the episode MP3 and manifest (src/pipeline/phase3.ts). */
  async assemble(runId, m) {
    const { summary } = await assembleEpisode(runId, m);
    return { summary, usage: [] };
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
    // The failure policy is applied when a script is assembled (src/pipeline/policy.ts), not here.
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
