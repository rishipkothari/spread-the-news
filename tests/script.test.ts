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
const ALWAYS_WRONG_SIDE = "story-wrong-side";
vi.mock("@/stages/script", async (orig) => {
  const real = await orig<typeof import("@/stages/script")>();
  const flaky: ScriptWriter = {
    id: "flaky",
    async write(input, revision) {
      if (input.story.id === ALWAYS_WRONG_SIDE) return { text: `Left-leaning outlets (Breitbart) say ${input.synthesis.title}.`, usage: [] };
      // First draft puts an outlet under the wrong side; the rewrite fixes it.
      return { text: revision ? `Right-leaning outlets (Fox News) report ${input.synthesis.title}.` : `Left-leaning outlets (Fox News) report ${input.synthesis.title}.`, usage: [] };
    },
  };
  const passAll: ScriptChecker = { id: "pass-all", async check() { return { result: { pass: true, claims: [{ claim: "x", support: ["F1"], status: "supported" }], issues: [], checker: "pass-all" }, usage: [] }; } };
  return { ...real, writers: { ...real.writers, flaky }, checkers: { ...real.checkers, "pass-all": passAll } };
});

const { TONE_RULES } = await import("@/stages/script/tone");
const { wordBudgetV1, wordBudgets } = await import("@/stages/plan/word-budget-v1");
const { buildMaterial, describeOutlets } = await import("@/stages/script/material");
const { codeChecks, isOutletList } = await import("@/stages/script/checks");
const { applyRules } = await import("@/audio/spoken");
const { toCheckResult, materialIds, CHECK_SYSTEM } = await import("@/stages/script/quote-trace-v1");
const { WRITE_SYSTEM, buildWriteUser } = await import("@/stages/script/neutral-v1");
const { resolveSynthesis, SynthesizeOutput } = await import("@/stages/synthesize/sonnet-synthesis-v1");
const { templateText, enabledTemplates, listTitles } = await import("@/stages/script/templates");
const { buildScriptInput, planScriptUnits, runScriptUnit, mergeScript, refreshFixedSegments } = await import("@/pipeline/phase2");
const { loadShowText, saveShowText, SHOW_TEXT_PATH } = await import("@/show/store");
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
    expect(plan.stories[0].wordBudget).toBeGreaterThan(plan.stories[4].wordBudget); // first stories run longer
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

  it("budgets: by position, the last value repeats, scaled to fit a short target, never below the minimum", () => {
    expect(wordBudgets(3, 5000, [540, 540, 390])).toEqual([540, 540, 390]);
    expect(wordBudgets(5, 5000, [540, 390])).toEqual([540, 390, 390, 390, 390]);
    const five = wordBudgets(5, Math.round((config.vanilla.targetDurationSec / 60) * config.script.wordsPerMinute));
    expect(five).toEqual(config.script.storyWords); // the generic episode fits its own budgets without scaling
    const tight = wordBudgets(10, 600);
    expect(tight.every((w) => w >= config.script.minStoryWords)).toBe(true);
    expect(wordBudgets(0, 2000)).toEqual([]);
  });
});

describe("story material", () => {
  it("names outlets with their sides, so the script can credit them", () => {
    const { input } = stopgap();
    const m = buildMaterial(input);
    expect(Object.values(input.nameOf).some((n) => m.includes(n))).toBe(true);
    expect(Object.values(input.nameOf).join(" ")).not.toMatch(/\(/); // on-air names: "The Guardian", not "The Guardian (US)"
    expect(m).toMatch(/^COV: covered by \w+ outlets?: \d+ left-leaning/m);
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
    expect(describeOutlets(["a", "b", "c"], { a: "left", b: "left", c: "center" }, { a: "HuffPost", b: "Vox", c: "NPR" })).toBe(
      "two left-leaning outlets (HuffPost, Vox) and one centrist outlet (NPR)",
    );
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
  it("allows outlet names, ours or not, and outlet lists in parentheses", () => {
    expect(codeChecks("Fox News reported it. The BBC said so. Bloomberg first reported the sale.", sources)).toEqual([]);
    expect(codeChecks("Left-leaning outlets (HuffPost and The Nation) report it, while right-leaning ones (Fox News, Breitbart) stress cost.", sources)).toEqual([]);
    expect(codeChecks("One centrist outlet (The Hill) and one report (Bloomberg) say so.", sources)).toEqual([]);
    expect(codeChecks("Lawmakers on Capitol Hill and across the nation reacted.", sources)).toEqual([]);
    expect(isOutletList("HuffPost, Vox and The Wall Street Journal")).toBe(true);
    expect(isOutletList("HR 12")).toBe(false);
  });
  it("catches an outlet named under the wrong side", () => {
    const issues = codeChecks("Left-leaning outlets (HuffPost and Fox News) report it.", sources);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: "attribution", severity: "must_fix" });
    expect(issues[0].problem).toMatch(/Fox News is a right-leaning outlet, not left-leaning/);
    expect(codeChecks("One right-leaning outlet (the Hill) says so.", sources)[0].kind).toBe("attribution");
    expect(codeChecks("Right-leaning outlets (Bloomberg) say so.", sources)).toEqual([]); // not ours: no side to check
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
  it("welcome is generic, rundown lists the stories, each template can be switched off", () => {
    expect(listTitles(["A.", "B", "C"])).toBe("A; B; and C");
    expect(templateText("rundown", ["One"])).toContain("One");
    expect(templateText("rundown", ["A", "B", "C", "D", "E"])).toBe("Here's what's up today: A; B; C; and more.");
    expect(templateText("rundown", ["A", "B", "C"])).toBe("Here's what's up today: A; B; and C.");
    expect(templateText("welcome", ["One"])).not.toContain("One");
    expect(enabledTemplates()).toEqual({ before: ["welcome", "rundown"], after: ["outro"] });
    expect(enabledTemplates(["rundown"])).toEqual({ before: ["rundown"], after: [] });
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
    stories[2] = { ...stories[2], id: ALWAYS_WRONG_SIDE };
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

  it("rewrites once on failure, drops a story that fails twice, assembles welcome + rundown + stories + outro", async () => {
    seed({ script: "flaky", check: "pass-all" });
    const ids = await runPhase2();
    expect(ids.length).toBe(4);
    const script = store.get(paths.stage(runId, "script")) as import("@/lib/types").EpisodeScript;
    const kinds = script.segments.map((s) => s.kind);
    expect(kinds.slice(0, 2)).toEqual(["welcome", "rundown"]);
    expect(kinds.at(-1)).toBe("outro");
    expect(kinds.filter((k) => k === "story").length).toBe(3);
    expect(script.dropped.map((d) => d.storyId)).toEqual([ALWAYS_WRONG_SIDE]);
    expect(script.dropped[0].reason).toMatch(/attribution: Breitbart is a right-leaning outlet/);
    for (const s of script.segments.filter((x) => x.kind === "story")) expect(s.text).toMatch(/^Right-leaning outlets \(Fox News\)/);
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
    expect(report).toContain("draft 1 failed");
    expect(report).toContain("## Dropped from this episode (1)");
    expect(report.indexOf("## Dropped from this episode")).toBeLessThan(report.indexOf("## Script"));
    const dropped = store.get(paths.unit(runId, "script", ALWAYS_WRONG_SIDE)) as import("@/pipeline/phase2").ScriptUnit;
    expect(dropped.attempts.length).toBe(config.script.maxAttempts); // full rewrites until the limit, then dropped
    expect(script.dropped[0].reason).toMatch(/failed the check 3 times/);
  });

  it("intro lines saved on /debug/show go into new scripts, and into an existing one without touching stories", async () => {
    seed({ script: "stub", check: "stub" });
    expect((await loadShowText()).origin).toBe("repo");
    await runPhase2();
    const before = store.get(paths.stage(runId, "script")) as import("@/lib/types").EpisodeScript;
    expect(before.segments[0].text).toBe(config.script.welcome);

    await saveShowText({ welcome: "Welcome to Prism News.", rundown: "Today: {stories}.", outro: "" });
    expect(await loadShowText()).toMatchObject({ welcome: "Welcome to Prism News.", origin: "blob" });
    const { changed } = await refreshFixedSegments(runId);
    expect(changed.sort()).toEqual(["outro", "rundown", "welcome"]);
    const after = store.get(paths.stage(runId, "script")) as import("@/lib/types").EpisodeScript;
    expect(after.segments.map((x) => x.kind)).toEqual(["welcome", "rundown", "story", "story", "story", "story"]); // empty sign-off is skipped
    expect(after.segments[0]).toMatchObject({ text: "Welcome to Prism News.", scriptHash: expect.any(String) });
    expect(after.segments[1].text).toMatch(/^Today: .+\.$/);
    expect(after.segments.filter((x) => x.kind === "story")).toEqual(before.segments.filter((x) => x.kind === "story"));
    expect(after.words).toBeLessThan(before.words);
    expect((await refreshFixedSegments(runId)).changed).toEqual([]);

    await mergeScript(runId); // a fresh script uses the saved lines too
    expect((store.get(paths.stage(runId, "script")) as import("@/lib/types").EpisodeScript).segments[0].text).toBe("Welcome to Prism News.");
    store.set(SHOW_TEXT_PATH, null);
    expect((await loadShowText()).welcome).toBe(config.script.welcome);
  });

  it("stub writer + stub checker: everything passes for free", async () => {
    seed({ script: "stub", check: "stub" });
    await runPhase2();
    const script = store.get(paths.stage(runId, "script")) as import("@/lib/types").EpisodeScript;
    expect(script.dropped).toEqual([]);
    expect(script.segments.filter((s) => s.kind === "story").length).toBe(4);
    expect((script.segments.find((s) => s.kind === "story")!.checkerResult as CheckResult).checker).toBe("stub");
  });
});

describe("outlet credits read aloud", () => {
  it("turns a parenthesized outlet list into a spoken aside, leaving codes like 401(k) alone", () => {
    expect(applyRules("Left-leaning outlets (HuffPost, Vox) report it.").text).toBe("Left-leaning outlets, HuffPost and Vox, report it.");
    expect(applyRules("It was reported by one right-leaning outlet (Fox News).").text).toBe("It was reported by one right-leaning outlet, Fox News.");
    expect(applyRules("Centrist ones (NPR and The Hill), meanwhile, agree.").text).toBe("Centrist ones, NPR and The Hill, meanwhile, agree.");
    expect(applyRules("Savers moved money into 401(k) plans.").text).toBe("Savers moved money into 401(k) plans.");
  });
});

describe("sample segment (tone reference, written offline from the fixture's writer prompt)", () => {
  it("passes the code checks", () => {
    const text = readFileSync(new URL("./fixtures/script/sample-segment.txt", import.meta.url), "utf8");
    expect(codeChecks(text, sources)).toEqual([]);
  });
});

describe("phase 2 refinements", () => {
  it("minor disagreements stay out of the script material; older runs without a level count as material", () => {
    const { input } = stopgap();
    const disputed = [
      { claim: "ESPN tenure", significance: "minor" as const, positions: [{ position: "since 1987", sourceIds: ["motherjones"] }, { position: "29 years", sourceIds: ["fox"] }] },
      { claim: "Death toll", significance: "material" as const, positions: [{ position: "12", sourceIds: ["motherjones"] }, { position: "15", sourceIds: ["fox"] }] },
      { claim: "Legacy run", positions: [{ position: "x", sourceIds: ["motherjones"] }, { position: "y", sourceIds: ["fox"] }] },
    ];
    const m = buildMaterial({ ...input, synthesis: { ...input.synthesis, disputed } });
    expect(m).not.toContain("ESPN tenure");
    expect(m).toContain("D1: Death toll");
    expect(m).toContain("D2: Legacy run");
    expect(materialIds({ ...input, synthesis: { ...input.synthesis, disputed } }).has("D3")).toBe(false);
  });

  it("synthesis defaults a missing significance to material", () => {
    const si = synthInput as unknown as SynthesizeInput;
    const { synthesis } = resolveSynthesis(SynthesizeOutput.parse(synthResponse), si);
    expect(synthesis.disputed.every((d) => d.significance === "material")).toBe(true);
  });

  it("headlines are citable material, labelled with side and outlet", () => {
    const { input } = stopgap();
    const withName = { ...input, headlines: [{ text: "Senate passes stopgap", side: "right" as const, outlet: "Fox News" }, ...input.headlines] };
    const m = buildMaterial(withName);
    expect(m).toMatch(/^H1 \[right-leaning, Fox News\]: Senate passes stopgap$/m);
    expect(materialIds(withName).has("H1")).toBe(true);
    expect(input.headlines.length).toBeGreaterThan(0);
  });

  it("a rewrite shows the material the flagged claim should have used", () => {
    const { input } = stopgap();
    const user = buildWriteUser(input, {
      text: "Draft.",
      issues: [],
      claims: [
        { claim: "Vote was 61 to 38", support: [], related: ["F1"], status: "distorted" },
        { claim: "Lead azide is an explosive", support: [], status: "unsupported" },
      ],
    });
    expect(user).toMatch(/the material says: F1: The Senate passed/);
    expect(user).toContain("nothing in the material says this: leave it out");
    expect(user).toContain("Write the whole segment again");
  });

  it("not-planned reasons say exactly why", async () => {
    const { whyNoSynthesis } = await import("@/stages/plan/word-budget-v1");
    const analysis = { analyzedIds: ["a", "b", "c"], headlinesOnly: ["b"], errors: { c: "timeout" } };
    expect(whyNoSynthesis("z", analysis)).toBe("outside the top 3 stories analyzed");
    expect(whyNoSynthesis("b", analysis)).toMatch(/headlines only/);
    expect(whyNoSynthesis("c", analysis)).toBe("analysis failed: timeout");
  });
});

describe("who's who, one-sided coverage", () => {
  it("finds role phrases across today's material and offers only the missing ones", async () => {
    const { extractRoles, whoIsWhoFor } = await import("@/stages/script/whoswho");
    const roles = extractRoles([
      "Transportation Secretary Sean Duffy said the FBI found no evidence of a cyberattack.",
      "Homeland Security Secretary Mullin suggested AI could have played a role.",
      "The Director of National Intelligence Clayton says outages stem from upgrades.",
      "President Trump Says Iran is more aggressive.",
      "Senate Democrats push back.",
    ]);
    const phrases = roles.map((r) => r.phrase);
    expect(phrases).toEqual(expect.arrayContaining(["Transportation Secretary Sean Duffy", "Homeland Security Secretary Mullin", "Director of National Intelligence Clayton", "President Trump"]));
    expect(phrases.some((p) => /Democrats|Says/.test(p))).toBe(false);
    expect(whoIsWhoFor("another official, Duffy, said so. Homeland Security Secretary Mullin agreed.", roles)).toEqual(["Transportation Secretary Sean Duffy"]);
  });

  it("who's-who lines are citable material", () => {
    const { input } = stopgap();
    const withW = { ...input, whoIsWho: ["Majority Leader John Doe"] };
    expect(buildMaterial(withW)).toMatch(/^W1: Majority Leader John Doe$/m);
    expect(materialIds(withW).has("W1")).toBe(true);
  });

  it("one-sided coverage: say so instead of comparing sides", () => {
    const { input } = stopgap();
    const right = { ...input, coverage: { left: 0, center: 0, right: 2 } };
    expect(buildMaterial(right)).toContain("COVERAGE NOTE: only right-leaning outlets covered this story");
    expect(buildMaterial(right)).toContain("FRAMING (one side only");
    expect(buildMaterial(input)).not.toContain("COVERAGE NOTE");
  });
});
