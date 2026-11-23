import { config } from "@/lib/config";
import { sha } from "@/lib/hash";
import { getJson, paths, putJson } from "@/lib/storage";
import type { CheckResult, EpisodePlan, EpisodeScript, LeanGroup, PlannedStory, Segment, Story, StoryBundle, StorySynthesis } from "@/lib/types";
import { impls, type Methods } from "@/stages/registry";
import { leanGroup } from "@/stages/rank/headline-index-v1";
import { codeChecks, lengthIssue, verdict, wordCount } from "@/stages/script/checks";
import { introText, outroText } from "@/stages/script/templates";
import type { LlmUsageEntry, Revision, ScriptInput } from "@/stages/types";
import { isSystemic, stageUsage, type SynthesizeOut } from "./phase1";
import { meetsFailurePolicy } from "./policy";
import { appendUsage, readStatus, updateStatus } from "./status";

/**
 * Phase 2 script stage, one workflow step per planned story (the "plan" stage runs first, in run.ts):
 *   planScriptUnits → runScriptUnit × N (write → check → one rewrite → check → keep or drop; runs/{id}/script/{storyId}.json)
 *   → mergeScript (intro + kept segments + outro → runs/{id}/script.json; usage; status; failure policy).
 * Kept segments also go to the story bank at segments/{scriptHash}.json.
 */

export interface ScriptAttempt {
  text: string;
  words: number;
  check: CheckResult;
}

export interface ScriptUnit {
  storyId: string;
  title: string;
  attempts: ScriptAttempt[];
  segment?: Segment;
  dropped?: string; // why the story was dropped
  error?: string;
  usage: LlmUsageEntry[];
  ms: number;
}

async function need<T>(path: string, what: string): Promise<T> {
  const v = await getJson<T>(path);
  if (!v) throw new Error(`missing ${what} (${path})`);
  return v;
}

async function methodsOf(runId: string): Promise<Methods> {
  const s = await readStatus(runId);
  return { ...config.methods, ...(s?.methods ?? {}) } as Methods;
}

/** Sides and per-side outlet counts for everything that covered the story; outlets are never named downstream. */
export function buildScriptInput(story: Story, synthesis: StorySynthesis, bundle: Pick<StoryBundle, "articles" | "sources">, planned: PlannedStory): ScriptInput {
  const sources = new Map(bundle.sources.map((s) => [s.id, s]));
  const articles = new Map(bundle.articles.map((a) => [a.id, a]));
  const sideOf: Record<string, LeanGroup> = {};
  for (const id of story.articleIds) {
    const a = articles.get(id);
    if (a) sideOf[a.sourceId] = leanGroup(sources.get(a.sourceId)?.leanValue ?? 0);
  }
  // Outlets cited by the synthesis but missing from the article list still need a side.
  const cited = [...(synthesis.singleSourceFacts ?? []).map((f) => f.sourceId), ...synthesis.disputed.flatMap((d) => d.positions.flatMap((p) => p.sourceIds))];
  for (const id of cited) sideOf[id] ??= leanGroup(sources.get(id)?.leanValue ?? 0);
  const covering = new Set(story.articleIds.map((id) => articles.get(id)?.sourceId).filter((x): x is string => !!x));
  const coverage: Record<LeanGroup, number> = { left: 0, center: 0, right: 0 };
  for (const sourceId of covering) coverage[sideOf[sourceId]]++;
  return {
    story: { id: story.id, title: synthesis.title, category: story.category },
    synthesis,
    sideOf,
    outlets: bundle.sources.map((s) => ({ name: s.name, side: leanGroup(s.leanValue) })),
    coverage,
    wordBudget: planned.wordBudget,
    lead: planned.lead,
    includeRecently: config.script.includeRecently,
  };
}

export async function planScriptUnits(runId: string): Promise<string[]> {
  const plan = await need<EpisodePlan>(paths.stage(runId, "plan"), "episode plan; run the plan stage first");
  const ids = plan.stories.map((s) => s.storyId);
  await updateStatus(runId, (s) => {
    s.state = "running";
    s.stages.script = { state: "running", startedAt: new Date().toISOString(), summary: { stories: ids.length } };
  });
  return ids;
}

export async function runScriptUnit(runId: string, storyId: string): Promise<void> {
  const t0 = Date.now();
  const [bundle, plan, synth, m] = await Promise.all([
    need<StoryBundle>(paths.bundle(runId), "bundle"),
    need<EpisodePlan>(paths.stage(runId, "plan"), "episode plan"),
    need<SynthesizeOut>(paths.stage(runId, "synthesize"), "synthesis"),
    methodsOf(runId),
  ]);
  const planned = plan.stories.find((s) => s.storyId === storyId);
  const story = bundle.stories.find((s) => s.id === storyId);
  const synthesis = synth.syntheses.find((s) => s.storyId === storyId);
  if (!planned || !story || !synthesis) throw new Error(`story ${storyId} is not in the plan, bundle and synthesis of run ${runId}`);

  const input = buildScriptInput(story, synthesis, bundle, planned);
  const writer = impls.script(m);
  const checker = impls.check(m);
  const unit: ScriptUnit = { storyId, title: synthesis.title, attempts: [], usage: [], ms: 0 };

  try {
    let revision: Revision | undefined;
    for (let attempt = 0; attempt < 2 && !unit.segment; attempt++) {
      const w = await writer.write(input, revision);
      unit.usage.push(...w.usage);
      const c = await checker.check(input, w.text);
      unit.usage.push(...c.usage);
      const issues = [...c.result.issues, ...codeChecks(w.text, bundle.sources)];
      const len = lengthIssue(w.text, input.wordBudget);
      if (len) issues.push(len);
      const check: CheckResult = { ...c.result, issues, pass: verdict(c.result.claims, issues) };
      unit.attempts.push({ text: w.text, words: wordCount(w.text), check });
      if (check.pass) {
        const scriptHash = sha(w.text);
        unit.segment = { id: `seg-${storyId}`, storyId, kind: "story", text: w.text, checkerResult: check, scriptHash, words: wordCount(w.text) };
      } else {
        revision = { text: w.text, issues: check.issues, claims: check.claims };
      }
    }
    if (!unit.segment) {
      const last = unit.attempts.at(-1)?.check;
      const why = [
        ...(last?.issues.filter((i) => i.severity === "must_fix").map((i) => `${i.kind}: ${i.problem}`) ?? []),
        ...(last?.claims.filter((c) => c.status !== "supported").map((c) => `${c.status}: ${c.claim}`) ?? []),
      ];
      unit.dropped = `failed the check twice: ${why.slice(0, 3).join("; ") || "unknown"}`;
    }
  } catch (e) {
    if (isSystemic(e)) throw e;
    unit.error = (e as Error).message;
    unit.dropped = `error: ${unit.error}`;
  }

  unit.ms = Date.now() - t0;
  await putJson(paths.unit(runId, "script", storyId), unit);
  if (unit.segment) await putJson(paths.segment(unit.segment.scriptHash), { ...unit.segment, runId, title: unit.title, createdAt: new Date().toISOString() });
}

export async function mergeScript(runId: string): Promise<void> {
  const [plan, bundle, status] = await Promise.all([
    need<EpisodePlan>(paths.stage(runId, "plan"), "episode plan"),
    need<StoryBundle>(paths.bundle(runId), "bundle"),
    readStatus(runId),
  ]);
  const units = (await Promise.all(plan.stories.map((s) => getJson<ScriptUnit>(paths.unit(runId, "script", s.storyId))))).filter((u): u is ScriptUnit => !!u);
  const byId = new Map(units.map((u) => [u.storyId, u]));
  const stories = plan.stories.map((p) => byId.get(p.storyId)?.segment).filter((s): s is Segment => !!s);
  const titles = plan.stories.filter((p) => byId.get(p.storyId)?.segment).map((p) => byId.get(p.storyId)!.title);

  const template = (kind: "intro" | "outro", text: string): Segment => ({ id: `seg-${kind}`, kind, text, checkerResult: { pass: true, template: true }, scriptHash: sha(text), words: wordCount(text) });
  const segments = stories.length ? [template("intro", introText(titles)), ...stories, template("outro", outroText())] : [];
  const dropped = plan.stories
    .filter((p) => !byId.get(p.storyId)?.segment)
    .map((p) => ({ storyId: p.storyId, title: p.title, reason: byId.get(p.storyId)?.dropped ?? "no output (step didn't run)" }));
  const policy = meetsFailurePolicy({ sourceHealth: bundle.sourceHealth, checkedStories: stories.length }, config.failurePolicy);
  const words = segments.reduce((a, s) => a + s.words, 0);
  const errors = stories.length ? [] : ["no story passed the checker, so there is no script"];

  const script: EpisodeScript = {
    runId,
    date: bundle.window.end.slice(0, 10),
    params: status?.params ?? plan.params,
    segments,
    dropped,
    words,
    estMinutes: +(words / plan.wordsPerMinute).toFixed(1),
    policy,
    errors,
  };
  await putJson(paths.stage(runId, "script"), script);
  await appendUsage(runId, stageUsage("script", units));
  const rewritten = units.filter((u) => u.segment && u.attempts.length > 1).length;
  await updateStatus(runId, (s) => {
    s.stages.script = {
      ...s.stages.script,
      state: "done",
      finishedAt: new Date().toISOString(),
      summary: { stories: stories.length, rewritten, dropped: dropped.length, words, minutes: script.estMinutes },
    };
    s.errors = s.errors.filter((e) => !e.startsWith("script:"));
    for (const e of errors) s.errors.push(`script: ${e}`);
  });
}
