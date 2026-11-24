import Anthropic from "@anthropic-ai/sdk";
import { config } from "@/lib/config";
import { sha } from "@/lib/hash";
import { getJson, paths, putJson } from "@/lib/storage";
import { PROMINENCE_ORDER, type Article, type ArticleFacts, type ExtractedText, type Source, type Story, type StoryBundle, type StorySynthesis, type UsageEntry } from "@/lib/types";
import { impls, type Methods } from "@/stages/registry";
import type { LlmUsageEntry } from "@/stages/types";
import { addHistorySummaries, historyChain, readHistory } from "./history";
import type { Phase1Stage } from "./stages";
import { appendUsage, readStatus, updateStatus } from "./status";

/**
 * Phase 1 stages fan out as one workflow step per selected story:
 *   planUnits (story ids) → runUnit × N (writes runs/{id}/{stage}/{storyId}.json) → mergeStage (runs/{id}/{stage}.json, usage, status).
 * Units never update status or usage themselves, so parallel steps can't race on shared files.
 * Content failures (a page that won't load, invalid LLM output for one article) are recorded in the unit output, not thrown;
 * errors that would hit every unit (bad API key, malformed request) are rethrown so the stage fails loudly.
 */

export interface AnalysisPlan {
  storyIds: string[];
  articleIds: Record<string, string[]>; // storyId → articles chosen for analysis
}

export interface ExtractUnit { storyId: string; texts: ExtractedText[]; cacheHits: number; ms: number }
export interface AnalyzeUnit { storyId: string; facts: ArticleFacts[]; errors: string[]; usage: LlmUsageEntry[]; ms: number }
export interface SynthesizeUnit { storyId: string; synthesis?: StorySynthesis; skipped?: "no_facts"; error?: string; usage: LlmUsageEntry[]; ms: number }

export interface ExtractOut {
  texts: Record<string, ExtractedText>;
  report: Record<string, { attempted: number; full: number; partial: number; headline_only: number; byExtractor: Record<string, number>; errors: string[] }>;
}
export interface AnalyzeOut { facts: ArticleFacts[]; errors: string[] }
export interface SynthesizeOut { syntheses: StorySynthesis[]; skipped?: string[]; errors: string[] }

// ---------- helpers ----------

async function needBundle(runId: string): Promise<StoryBundle> {
  const b = await getJson<StoryBundle>(paths.bundle(runId));
  if (!b) throw new Error(`run ${runId} has no bundle; run discovery (through rank) first`);
  return b;
}

async function needPlan(runId: string): Promise<AnalysisPlan> {
  const p = await getJson<AnalysisPlan>(paths.analysisPlan(runId));
  if (!p) throw new Error(`run ${runId} has no analysis plan; run the extract stage first`);
  return p;
}

async function methodsOf(runId: string): Promise<Methods> {
  const s = await readStatus(runId);
  return { ...config.methods, ...(s?.methods ?? {}) } as Methods;
}

/** Errors that would fail every unit the same way: surface them instead of recording per article. */
export function isSystemic(e: unknown): boolean {
  return (
    e instanceof Anthropic.AuthenticationError ||
    e instanceof Anthropic.PermissionDeniedError ||
    e instanceof Anthropic.NotFoundError ||
    e instanceof Anthropic.BadRequestError
  );
}

/**
 * One article per outlet that covered the story, so every outlet is heard: each outlet's best piece
 * (news before analysis before opinion, then the more prominent feed, then the newest).
 * Only above `max` (a safety cap for the step's time limit) are outlets dropped, taking turns across left, center and right
 * so no side is cut first.
 */
export function pickArticles(story: Story, articles: Map<string, Article>, max: number, leanOf: (sourceId: string) => number = () => 0): string[] {
  const typeOrder: Record<string, number> = { news: 0, analysis: 1, opinion: 2 };
  const better = (x: Article, y: Article) =>
    (typeOrder[x.articleType ?? "news"] ?? 3) - (typeOrder[y.articleType ?? "news"] ?? 3) ||
    PROMINENCE_ORDER[y.prominence] - PROMINENCE_ORDER[x.prominence] ||
    (x.publishedAt < y.publishedAt ? 1 : x.publishedAt > y.publishedAt ? -1 : 0);
  const best = new Map<string, Article>();
  for (const id of story.articleIds) {
    const a = articles.get(id);
    if (!a) continue;
    const prev = best.get(a.sourceId);
    if (!prev || better(a, prev) < 0) best.set(a.sourceId, a);
  }
  const picks = [...best.values()].sort(better);
  if (picks.length <= max) return picks.map((a) => a.id);
  const side = (a: Article) => Math.sign(leanOf(a.sourceId));
  const queues = [-1, 0, 1].map((g) => picks.filter((a) => side(a) === g));
  const out: string[] = [];
  for (let i = 0; out.length < max; i++) for (const q of queues) if (q[i] && out.length < max) out.push(q[i].id);
  return out;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

// ---------- plan ----------

export async function planUnits(runId: string, stage: Phase1Stage): Promise<string[]> {
  let storyIds: string[];
  if (stage === "extract") {
    const bundle = await needBundle(runId);
    const articles = new Map(bundle.articles.map((a) => [a.id, a]));
    const leans = new Map(bundle.sources.map((s) => [s.id, s.leanValue]));
    const chosen = bundle.stories.filter((s) => s.ranked).slice(0, config.analysis.topStories);
    const plan: AnalysisPlan = {
      storyIds: chosen.map((s) => s.id),
      articleIds: Object.fromEntries(chosen.map((s) => [s.id, pickArticles(s, articles, config.analysis.maxArticlesPerStory, (id) => leans.get(id) ?? 0)])),
    };
    await putJson(paths.analysisPlan(runId), plan);
    storyIds = plan.storyIds;
  } else {
    storyIds = (await needPlan(runId)).storyIds;
  }
  await updateStatus(runId, (s) => {
    s.state = "running";
    s.stages[stage] = { state: "running", startedAt: new Date().toISOString(), summary: { stories: storyIds.length } };
  });
  return storyIds;
}

// ---------- units ----------

export async function runUnit(runId: string, stage: Phase1Stage, storyId: string): Promise<void> {
  const t0 = Date.now();
  const [bundle, plan, m] = await Promise.all([needBundle(runId), needPlan(runId), methodsOf(runId)]);
  const story = bundle.stories.find((s) => s.id === storyId);
  if (!story) throw new Error(`story ${storyId} not in run ${runId}`);
  const articles = new Map(bundle.articles.map((a) => [a.id, a]));
  const sources = new Map(bundle.sources.map((s) => [s.id, s]));
  const chosen = (plan.articleIds[storyId] ?? []).map((id) => articles.get(id)).filter((a): a is Article => !!a);

  if (stage === "extract") {
    const extractor = impls.extract(m);
    let cacheHits = 0;
    const texts = await mapLimit(chosen, config.analysis.extractConcurrency, async (a) => {
      const key = paths.textCache(sha(a.url));
      const cached = await getJson<ExtractedText>(key);
      if (cached && cached.textStatus !== "headline_only") {
        cacheHits++;
        return { ...cached, articleId: a.id };
      }
      try {
        const t = await extractor.extract(a, sources.get(a.sourceId) as Source);
        if (t.textStatus !== "headline_only") await putJson(key, t);
        return t;
      } catch (e) {
        return { articleId: a.id, url: a.url, text: a.summary, textStatus: "headline_only", extractor: "error", chars: a.summary?.length ?? 0, error: (e as Error).message, fetchedAt: new Date().toISOString() } satisfies ExtractedText;
      }
    });
    await putJson(paths.unit(runId, stage, storyId), { storyId, texts, cacheHits, ms: Date.now() - t0 } satisfies ExtractUnit);
    return;
  }

  if (stage === "analyze") {
    const extracted = (await getJson<ExtractOut>(paths.stage(runId, "extract")))?.texts ?? {};
    const analyzer = impls.analyze(m);
    const errors: string[] = [];
    const usage: LlmUsageEntry[] = [];
    const facts = await mapLimit(chosen, config.analysis.analyzeConcurrency, async (a): Promise<ArticleFacts> => {
      const base = { articleId: a.id, sourceId: a.sourceId, storyId };
      if (a.articleType === "opinion") return { ...base, facts: [], skipped: "opinion" };
      const text = extracted[a.id];
      if (!text?.text || text.textStatus === "headline_only") return { ...base, facts: [], skipped: "no_text" };
      try {
        const r = await analyzer.analyze({ article: a, text, story: { id: story.id, title: story.title }, sourceName: sources.get(a.sourceId)?.name ?? a.sourceId });
        usage.push(...r.usage);
        return { ...base, facts: r.facts };
      } catch (e) {
        if (isSystemic(e)) throw e;
        errors.push(`${a.sourceId} ${a.id}: ${(e as Error).message}`);
        return { ...base, facts: [] };
      }
    });
    await putJson(paths.unit(runId, stage, storyId), { storyId, facts, errors, usage, ms: Date.now() - t0 } satisfies AnalyzeUnit);
    return;
  }

  // synthesize
  const [analyzed, extracted, history] = await Promise.all([
    getJson<AnalyzeOut>(paths.stage(runId, "analyze")),
    getJson<ExtractOut>(paths.stage(runId, "extract")),
    readHistory(bundle.window.end.slice(0, 10)),
  ]);
  const factsBy = new Map((analyzed?.facts ?? []).map((f) => [f.articleId, f.facts]));
  const input = {
    story,
    articles: chosen.map((a) => {
      const src = sources.get(a.sourceId);
      return {
        article: a,
        sourceName: src?.name ?? a.sourceId,
        lean: src?.lean ?? "center",
        leanValue: src?.leanValue ?? 0,
        textStatus: extracted?.texts[a.id]?.textStatus ?? "headline_only",
        facts: factsBy.get(a.id) ?? [],
      };
    }),
    history: historyChain(story.continuesStoryId, history),
  } as const;
  let unit: SynthesizeUnit;
  // No article text anywhere → nothing grounded to synthesize; never let a "no facts" summary reach a script.
  if (input.articles.every((a) => a.facts.length === 0)) {
    await putJson(paths.unit(runId, stage, storyId), { storyId, skipped: "no_facts", usage: [], ms: Date.now() - t0 } satisfies SynthesizeUnit);
    return;
  }
  try {
    const r = await impls.synthesize(m).synthesize({ ...input, articles: [...input.articles] });
    unit = { storyId, synthesis: r.synthesis, usage: r.usage, ms: Date.now() - t0 };
  } catch (e) {
    if (isSystemic(e)) throw e;
    unit = { storyId, error: (e as Error).message, usage: [], ms: Date.now() - t0 };
  }
  await putJson(paths.unit(runId, stage, storyId), unit);
}

// ---------- merge ----------

export function stageUsage(stage: string, units: { usage?: LlmUsageEntry[]; ms: number }[]): UsageEntry[] {
  // Summed step time across parallel per-story steps: a measure of work, not elapsed time.
  // The run page shows elapsed time from the stage's startedAt/finishedAt and this sum only as "step time".
  const ms = units.reduce((a, u) => a + u.ms, 0);
  const llm = units.flatMap((u) => u.usage ?? []);
  if (!llm.length) return [{ stage, ms }];
  return llm.map((u, i) => ({ ...u, stage, ms: i === 0 ? ms : 0 }));
}

export async function mergeStage(runId: string, stage: Phase1Stage): Promise<void> {
  const plan = await needPlan(runId);
  const load = <T,>(id: string) => getJson<T>(paths.unit(runId, stage, id));
  let summary: Record<string, unknown>;

  if (stage === "extract") {
    const units = (await Promise.all(plan.storyIds.map((id) => load<ExtractUnit>(id)))).filter((u): u is ExtractUnit => !!u);
    const bundle = await needBundle(runId);
    const sourceOf = new Map(bundle.articles.map((a) => [a.id, a.sourceId]));
    const out: ExtractOut = { texts: {}, report: {} };
    for (const t of units.flatMap((u) => u.texts)) {
      out.texts[t.articleId] = t;
      const src = sourceOf.get(t.articleId) ?? "?";
      const r = (out.report[src] ??= { attempted: 0, full: 0, partial: 0, headline_only: 0, byExtractor: {}, errors: [] });
      r.attempted++;
      r[t.textStatus]++;
      r.byExtractor[t.extractor] = (r.byExtractor[t.extractor] ?? 0) + 1;
      if (t.error && r.errors.length < 5) r.errors.push(t.error);
    }
    await putJson(paths.stage(runId, stage), out);
    await appendUsage(runId, stageUsage(stage, units));
    const all = Object.values(out.texts);
    summary = {
      stories: units.length,
      articles: all.length,
      full: all.filter((t) => t.textStatus === "full").length,
      partial: all.filter((t) => t.textStatus === "partial").length,
      headlineOnly: all.filter((t) => t.textStatus === "headline_only").length,
      cacheHits: units.reduce((a, u) => a + u.cacheHits, 0),
    };
  } else if (stage === "analyze") {
    const units = (await Promise.all(plan.storyIds.map((id) => load<AnalyzeUnit>(id)))).filter((u): u is AnalyzeUnit => !!u);
    const out: AnalyzeOut = { facts: units.flatMap((u) => u.facts), errors: units.flatMap((u) => u.errors) };
    await putJson(paths.stage(runId, stage), out);
    await appendUsage(runId, stageUsage(stage, units));
    summary = {
      articlesAnalyzed: out.facts.filter((f) => !f.skipped).length,
      skippedOpinion: out.facts.filter((f) => f.skipped === "opinion").length,
      skippedNoText: out.facts.filter((f) => f.skipped === "no_text").length,
      facts: out.facts.reduce((a, f) => a + f.facts.length, 0),
      errors: out.errors.length,
    };
  } else {
    const units = (await Promise.all(plan.storyIds.map((id) => load<SynthesizeUnit>(id)))).filter((u): u is SynthesizeUnit => !!u);
    const out: SynthesizeOut = {
      syntheses: units.flatMap((u) => (u.synthesis ? [u.synthesis] : [])),
      skipped: units.filter((u) => u.skipped).map((u) => u.storyId),
      errors: units.flatMap((u) => (u.error ? [`${u.storyId}: ${u.error}`] : [])),
    };
    await putJson(paths.stage(runId, stage), out);
    await appendUsage(runId, stageUsage(stage, units));
    const bundle = await needBundle(runId);
    await addHistorySummaries(bundle.window.end.slice(0, 10), bundle.stories, out.syntheses);
    summary = { syntheses: out.syntheses.length, headlinesOnly: out.skipped?.length ?? 0, errors: out.errors.length };
  }

  await updateStatus(runId, (s) => {
    s.stages[stage] = { ...s.stages[stage], state: "done", finishedAt: new Date().toISOString(), summary };
  });
}
