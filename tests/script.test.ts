import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/bundle-synthetic.json";
import synthInput from "./fixtures/analysis/responses/synth-input.json";
import synthResponse from "./fixtures/analysis/responses/synth.json";
import type { Article, Category, CheckResult, Source, SourceHealth, Story, StoryBundle, StorySynthesis } from "@/lib/types";
import type { ScriptChecker, ScriptInput, ScriptWriter, SynthesizeInput } from "@/stages/types";

// In-memory Blob.
const store = new Map<string, unknown>();
vi.mock("@/lib/storage", async (orig) => {
  const real = await orig<typeof import("@/lib/storage")>();
  return {
    ...real,
    putJson: async (p: string, d: unknown) => void store.set(p, structuredClone(d)),
    getJson: async (p: string) => (store.has(p) ? structuredClone(store.get(p)) : null),
    listPaths: async (prefix: string) => [...store.keys()].filter((k) => k.startsWith(prefix)),
  };
});

// Test writers/checkers alongside the real ones.
const ALWAYS_NAMES = "story-names-outlet";
vi.mock("@/stages/script", async (orig) => {
  const real = await orig<typeof import("@/stages/script")>();
  const flaky: ScriptWriter = {
    id: "flaky",
    async write(input, revision) {
      if (input.story.id === ALWAYS_NAMES) return { text: `Breitbart says ${input.synthesis.title}.`, usage: [] };
      // First draft names an outlet; the rewrite fixes it.
      return { text: revision ? `Here's the deal: ${input.synthesis.title}.` : `Fox News reports ${input.synthesis.title}.`, usage: [] };
    },
  };
  const passAll: ScriptChecker = { id: "pass-all", async check() { return { result: { pass: true, claims: [{ claim: "x", support: ["F1"], status: "supported" }], issues: [], checker: "pass-all" }, usage: [] }; } };
  return { ...real, writers: { ...real.writers, flaky }, checkers: { ...real.checkers, "pass-all": passAll } };
});

const { TONE_RULES } = await import("@/stages/script/tone");
const { wordBudgetV1, wordBudgets } = await import("@/stages/plan/word-budget-v1");
const { buildMaterial, describeOutlets } = await import("@/stages/script/material");
const { codeChecks, outletAliases } = await import("@/stages/script/checks");
const { toCheckResult, materialIds, CHECK_SYSTEM } = await import("@/stages/script/quote-trace-v1");
const { WRITE_SYSTEM, buildWriteUser } = await import("@/stages/script/neutral-v1");
const { resolveSynthesis, SynthesizeOutput } = await import("@/stages/synthesize/sonnet-synthesis-v1");
const { introText, listTitles } = await import("@/stages/script/templates");
const { buildScriptInput, planScriptUnits, runScriptUnit, mergeScript } = await import("@/pipeline/phase2");
const { runStage } = await import("@/pipeline/run");
const { meetsFailurePolicy } = await import("@/pipeline/policy");
const { buildScriptReport } = await import("@/review/script-report");
const { paths } = await import("@/lib/storage");
const { config, vanillaParams } = await import("@/lib/config");

const sources = fixture.sources as Source[];

/** The Phase 1 regression fixture's synthesis, resolved exactly as the app does. */
function stopgap(): { synthesis: StorySynthesis; input: ScriptInput } {
  const si = synthInput as unknown as SynthesizeInput;
  const { synthesis } = resolveSynthesis(SynthesizeOutput.parse(synthResponse), si);
  const story = si.story as Story;
  const bundle = {
    articles: si.articles.map((a) => a.article),
    sources: si.articles.map((a) => ({ id: a.article.sourceId, name: a.sourceName, leanValue: a.leanValue }) as Source),
  };
  const input = buildScriptInput(story, synthesis, bundle, { storyId: story.id, title: synthesis.title, category: "us", rank: 1, lead: true, wordBudget: 300 });
  return { synthesis, input };
}

function synth(storyId: string, title: string, facts = 2): StorySynthesis {
  return {
    storyId, title, summary: "",
    agreedFacts: Array.from({ length: facts }, (_, i) => ({ fact: `${title} fact ${i + 1}.`, support: [{ articleId: "a1", quote: "q" }] })),
    disputed: [], framing: { left: "Left framing.", right: "Right framing." },
  };
}

function story(id: string, category: Category, ranked = true): Story {
  return { id, title: id, category, articleIds: ["a1", "a2"], headlineIndex: 0.5, ranked };
}

describe("tone guide", () => {
  it("tone.ts matches the Rules section of docs/tone-guide.md", () => {
    const doc = readFileSync(new URL("../docs/tone-guide.md", import.meta.url), "utf8");
    const rules = doc.split("## Rules\n")[1].split("\n## Addenda")[0].trim();
    expect(TONE_RULES).toBe(rules);
  });
  it("is in both prompts", () => {
    expect(WRITE_SYSTEM).toContain(TONE_RULES);
    expect(CHECK_SYSTEM).toContain(TONE_RULES);
  });
});

describe("episode planner (word-budget-v1)", () => {
  const stories = [story("s1", "world"), story("s2", "us"), story("s3", "sports"), story("s4", "us"), story("s5", "science"), story("low", "us", false)];
  const syntheses = ["s1", "s2", "s3", "s4", "s5", "low"].map((id) => synth(id, `Title ${id}`));

  it("generic profile: straight rank order, lead first, unranked never planned", () => {
    const plan = wordBudgetV1.plan({ stories, syntheses, params: vanillaParams() });
    expect(plan.orderStrategy).toBe("rank");
    expect(plan.stories.map((s) => s.storyId)).toEqual(["s1", "s2", "s3", "s4", "s5"]);
    expect(plan.stories.map((s) => s.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(plan.stories[0].lead).toBe(true);
    expect(plan.stories[0].wordBudget).toBeGreaterThan(plan.stories[1].wordBudget);
  });

  it("skips stories without a synthesis or without facts, and plans whatever is left (even one)", () => {
    const plan = wordBudgetV1.plan({ stories, syntheses: [synth("s2", "Only one"), synth("s3", "No facts", 0)], params: vanillaParams() });
    expect(plan.stories.map((s) => s.storyId)).toEqual(["s2"]);
    expect(plan.skipped.find((s) => s.storyId === "s1")?.reason).toMatch(/no synthesis/);
    expect(plan.skipped.find((s) => s.storyId === "s3")?.reason).toMatch(/no facts/);
  });

  it("top-then-category groups after the lead", () => {
    const plan = wordBudgetV1.plan({ stories, syntheses, params: { ...vanillaParams(), orderStrategy: "top-then-category" } });
    expect(plan.stories.map((s) => s.storyId)).toEqual(["s1", "s2", "s4", "s5", "s3"]); // world lead, then us, us, science, sports
  });

  it("category list filters; a mix applies quotas and tops up to the minimum", () => {
    const list = wordBudgetV1.plan({ stories, syntheses, params: { ...vanillaParams(), categories: ["us"] } });
    expect(list.stories.map((s) => s.storyId)).toEqual(["s2", "s4"]);
    expect(list.skipped.find((s) => s.storyId === "s1")?.reason).toMatch(/not in profile/);

    const mix = wordBudgetV1.plan({ stories, syntheses, params: { ...vanillaParams(), categories: { us: 50, science: 50 }, storyCount: { min: 1, max: 2 } } });
    expect(mix.stories.map((s) => s.storyId)).toEqual(["s2", "s5"]); // one us (quota 1), one science; second us waits
    expect(mix.skipped.find((s) => s.storyId === "s4")?.reason).toMatch(/quota/);
  });

  it("budgets: lead bigger, scaled to fit a short target, never below the minimum", () => {
    expect(wordBudgets(3, 2000)).toEqual([config.script.leadWords, config.script.storyWords, config.script.storyWords]);
    const tight = wordBudgets(10, 600);
    expect(tight.every((w) => w >= config.script.minStoryWords)).toBe(true);
    expect(wordBudgets(0, 2000)).toEqual([]);
  });
});

describe("story material", () => {
  it("never names an outlet and labels sides", () => {
    const { input } = stopgap();
    const m = buildMaterial(input);
    for (const alias of outletAliases(sources)) expect(m).not.toContain(alias);
    expect(m).toMatch(/^COV: covered by/m);
    expect(m).toMatch(/^F1: /m);
    expect(m).toMatch(/FR-(left|center|right) \[/);
    expect(m).not.toContain("BG:"); // background off by default
  });

  it("includes background only when switched on", () => {
    const { input } = stopgap();
    expect(buildMaterial({ ...input, includeRecently: true })).toContain("BG:");
  });

  it("flags a one-outlet dispute so it can't be staged as a debate", () => {
    const { input } = stopgap();
    const one = { ...input, synthesis: { ...input.synthesis, disputed: [{ claim: "Death toll", positions: [{ position: "12", sourceIds: ["fox"] }, { position: "15", sourceIds: ["fox"] }] }] }, sideOf: { ...input.sideOf, fox: "right" as const } };
    expect(buildMaterial(one)).toContain("same single outlet");
    expect(describeOutlets(["a", "b", "c"], { a: "left", b: "left", c: "center" })).toBe("two left-leaning outlets and one centrist outlet");
  });

  it("write prompt carries budget and revision problems", () => {
    const { input } = stopgap();
    const user = buildWriteUser(input, { text: "Draft.", issues: [{ kind: "tone", severity: "must_fix", excerpt: "Draft", problem: "stiff", source: "checker" }], claims: [] });
    expect(user).toContain("about 300 words");
    expect(user).toContain("PREVIOUS DRAFT");
    expect(user).toContain("stiff");
  });
});

describe("code checks", () => {
  it("catches outlet names but not ordinary words", () => {
    expect(codeChecks("Fox News reported it.", sources).some((i) => i.kind === "outlet_named")).toBe(true);
    expect(codeChecks("The BBC said so.", sources).some((i) => i.kind === "outlet_named")).toBe(true);
    expect(codeChecks("Lawmakers on Capitol Hill and across the nation reacted.", sources)).toEqual([]);
    expect(outletAliases(sources)).not.toContain("Hill");
  });
  it("catches things that don't work read aloud", () => {
    const kinds = codeChecks('The bill (HR 12) passed. He said "this is the worst bill in a generation of bills".', sources).map((i) => i.problem);
    expect(kinds.some((p) => /parentheses/.test(p))).toBe(true);
    expect(kinds.some((p) => /direct quote/.test(p))).toBe(true);
  });
});

describe("checker verdict (quote-trace-v1)", () => {
  it("fails a 'supported' claim that cites a made-up id, passes minor-only issues", () => {
    const { input } = stopgap();
    expect(materialIds(input).has("F1")).toBe(true);
    const bad = toCheckResult({ claims: [{ claim: "x", support: ["F999"], status: "supported" }], issues: [] }, input, "t");
    expect(bad.pass).toBe(false);
    expect(bad.claims[0].status).toBe("unsupported");
    const ok = toCheckResult({ claims: [{ claim: "x", support: ["F1"], status: "supported" }], issues: [{ kind: "ear", severity: "minor", excerpt: "x", problem: "y" }] }, input, "t");
    expect(ok.pass).toBe(true);
  });
});

describe("templates and policy", () => {
  it("lists titles for the intro", () => {
    expect(listTitles(["A.", "B", "C"])).toBe("A; B; and C");
    expect(introText(["One"])).toContain("One");
  });
  it("failure policy is suspended: always ok, but notes what would fail", () => {
    const r = meetsFailurePolicy({ sourceHealth: { a: { ok: true, items: 1, inWindow: 1 } }, checkedStories: 1 }, config.failurePolicy);
    expect(r.ok).toBe(true);
    expect(r.reasons.length).toBe(2);
  });
});

describe("phase 2 runner", () => {
  const runId = "p2";
  function seed(methods: Record<string, string>) {
    store.clear();
    const stories = (fixture.stories as Story[]).map((s, i) => ({ ...s, ranked: true, headlineIndex: 1 - i / 10 }));
    stories[2] = { ...stories[2], id: ALWAYS_NAMES };
    const bundle: StoryBundle = {
      runId, createdAt: fixture.window.end, window: fixture.window, params: vanillaParams(), methods: {},
      sources, sourceHealth: fixture.sourceHealth as SourceHealth, articles: fixture.articles as Article[], stories,
    };
    store.set(paths.bundle(runId), bundle);
    store.set(paths.stage(runId, "synthesize"), { syntheses: stories.slice(0, 4).map((s) => synth(s.id, s.title)), errors: [] });
    store.set(paths.status(runId), { runId, state: "running", params: vanillaParams(), methods: { ...config.methods, ...methods }, stages: { synthesize: { state: "done" } }, errors: [], createdAt: "", updatedAt: "" });
    return bundle;
  }

  async function runPhase2() {
    await runStage(runId, "plan");
    const ids = await planScriptUnits(runId);
    for (const id of ids) await runScriptUnit(runId, id);
    await mergeScript(runId);
    return ids;
  }

  it("rewrites once on failure, drops a story that fails twice, assembles intro + stories + outro", async () => {
    seed({ script: "flaky", check: "pass-all" });
    const ids = await runPhase2();
    expect(ids.length).toBe(4);
    const script = store.get(paths.stage(runId, "script")) as import("@/lib/types").EpisodeScript;
    const kinds = script.segments.map((s) => s.kind);
    expect(kinds[0]).toBe("intro");
    expect(kinds.at(-1)).toBe("outro");
    expect(kinds.filter((k) => k === "story").length).toBe(3);
    expect(script.dropped.map((d) => d.storyId)).toEqual([ALWAYS_NAMES]);
    expect(script.dropped[0].reason).toMatch(/outlet_named/);
    for (const s of script.segments) expect(s.text).not.toMatch(/Fox News|Breitbart/);
    expect(script.policy.ok).toBe(true);

    const unit = store.get(paths.unit(runId, "script", ids[0])) as import("@/pipeline/phase2").ScriptUnit;
    expect(unit.attempts.length).toBe(2);
    expect(unit.attempts[0].check.pass).toBe(false);
    expect(store.has(paths.segment(unit.segment!.scriptHash))).toBe(true);

    const status = store.get(paths.status(runId)) as { stages: Record<string, { state: string; summary: Record<string, unknown> }> };
    expect(status.stages.script.state).toBe("done");
    expect(status.stages.script.summary).toMatchObject({ stories: 3, rewritten: 3, dropped: 1 });

    const report = buildScriptReport(runId, store.get(paths.stage(runId, "plan")) as never, script, ids.map((id) => store.get(paths.unit(runId, "script", id))) as never, [], { runId, notes: "Too formal", segments: { [`seg-${ids[0]}`]: { vote: "down", note: "stiff" } } });
    expect(report).toContain("## Script");
    expect(report).toContain("👎 my note: stiff");
    expect(report).toContain("first draft failed");
    expect(report).toContain("## Dropped by the checker");
  });

  it("stub writer + stub checker: everything passes for free", async () => {
    seed({ script: "stub", check: "stub" });
    await runPhase2();
    const script = store.get(paths.stage(runId, "script")) as import("@/lib/types").EpisodeScript;
    expect(script.dropped).toEqual([]);
    expect(script.segments.filter((s) => s.kind === "story").length).toBe(4);
    expect((script.segments[1].checkerResult as CheckResult).checker).toBe("stub");
  });
});

describe("outlet scrubbing", () => {
  it("replaces names in Phase 1 text with sides, leaving ordinary words alone", async () => {
    const { scrubOutlets } = await import("@/stages/script/material");
    const outlets = [
      { name: "The Hill", side: "center" as const },
      { name: "Fox News", side: "right" as const },
      { name: "BBC News", side: "center" as const },
      { name: "Mother Jones", side: "left" as const },
    ];
    expect(scrubOutlets("Mother Jones frames it, with the Hill adding floor debate and the BBC's take.", outlets)).toBe(
      "A left-leaning outlet frames it, with a centrist outlet adding floor debate and a centrist outlet's take.",
    );
    expect(scrubOutlets("Fox News and Fox both reported it on Capitol Hill.", outlets)).toBe("A right-leaning outlet and a right-leaning outlet both reported it on Capitol Hill.");
  });
});

describe("sample segment (tone reference, written offline from the fixture's writer prompt)", () => {
  it("passes the code checks", () => {
    const text = readFileSync(new URL("./fixtures/script/sample-segment.txt", import.meta.url), "utf8");
    expect(codeChecks(text, sources)).toEqual([]);
  });
});
