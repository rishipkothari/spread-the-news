import { beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/bundle-synthetic.json";
import type { Article, Source, SourceHealth, Story, StoryBundle } from "@/lib/types";

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

const { rankStories } = await import("@/stages/rank/headline-index-v1");
const { planUnits, runUnit, mergeStage, pickArticles } = await import("@/pipeline/phase1");
const { paths } = await import("@/lib/storage");
const { vanillaParams, config } = await import("@/lib/config");
const { historyChain } = await import("@/pipeline/history");

const runId = "t1";

function seed() {
  store.clear();
  const articles = (fixture.articles as Article[]).map((a, i) => ({
    ...a,
    feedText: i % 3 === 0 ? "Long feed body. ".repeat(80) : undefined,
    summary: `Summary of ${a.title}`,
  }));
  const stories = rankStories({ stories: fixture.stories as Story[], articles, sources: fixture.sources as Source[], sourceHealth: fixture.sourceHealth as SourceHealth, windowEnd: fixture.window.end });
  const bundle: StoryBundle = {
    runId, createdAt: fixture.window.end, window: fixture.window, params: vanillaParams(), methods: {},
    sources: fixture.sources as Source[], sourceHealth: fixture.sourceHealth as SourceHealth, articles, stories,
  };
  store.set(paths.bundle(runId), bundle);
  store.set(paths.status(runId), { runId, state: "running", params: vanillaParams(), methods: { ...config.methods }, stages: {}, errors: [], createdAt: "", updatedAt: "" });
  store.set(paths.history(), [
    { id: "s-old", date: "2026-11-19", title: "Funding talks begin", category: "us", summary: "Talks began." },
    { id: "s-mid", date: "2026-11-20", title: "Funding deadline nears", category: "us", continuesStoryId: "s-old" },
  ]);
  return bundle;
}

describe("phase 1 runner (stub implementations)", () => {
  beforeEach(() => void seed());

  it("plans, fans out per story and merges all three stages", async () => {
    for (const stage of ["extract", "analyze", "synthesize"] as const) {
      const ids = await planUnits(runId, stage);
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) await runUnit(runId, stage, id);
      await mergeStage(runId, stage);
    }
    const extract = store.get(paths.stage(runId, "extract")) as { texts: Record<string, { textStatus: string }>; report: Record<string, { attempted: number }> };
    const statuses = Object.values(extract.texts).map((t) => t.textStatus);
    expect(statuses).toContain("full");
    expect(statuses).toContain("headline_only");
    expect(Object.keys(extract.report).length).toBeGreaterThan(3);

    const analyze = store.get(paths.stage(runId, "analyze")) as { facts: { skipped?: string }[] };
    expect(analyze.facts.some((f) => f.skipped === "opinion")).toBe(true);
    expect(analyze.facts.some((f) => f.skipped === "no_text")).toBe(true);

    const syn = store.get(paths.stage(runId, "synthesize")) as { syntheses: { storyId: string; summary: string }[] };
    expect(syn.syntheses.length).toBe((store.get(paths.analysisPlan(runId)) as { storyIds: string[] }).storyIds.length);

    const status = store.get(paths.status(runId)) as { stages: Record<string, { state: string }> };
    expect(status.stages.extract.state).toBe("done");
    expect(status.stages.synthesize.state).toBe("done");

    const history = store.get(paths.history()) as { id: string; summary?: string }[];
    expect(history.find((h) => h.id === "universal")?.summary).toContain("Senate passes");
  });

  it("caches extracted full text by URL", async () => {
    const ids = await planUnits(runId, "extract");
    for (const id of ids) await runUnit(runId, "extract", id);
    await runUnit(runId, "extract", ids[0]);
    const unit = store.get(paths.unit(runId, "extract", ids[0])) as { cacheHits: number };
    expect(unit.cacheHits).toBeGreaterThan(0);
  });

  it("picks articles round-robin across outlets", () => {
    const bundle = seed();
    const story = bundle.stories.find((s) => s.id === "right-only")!; // fox×2, dailycaller×2, dailywire, breitbart, thehill
    const picked = pickArticles(story, new Map(bundle.articles.map((a) => [a.id, a])), 5);
    const outlets = picked.map((id) => bundle.articles.find((a) => a.id === id)!.sourceId);
    expect(new Set(outlets).size).toBe(5);
  });

  it("walks the history chain oldest first", () => {
    const h = [
      { id: "a", date: "1", title: "A", category: "us" as const },
      { id: "b", date: "2", title: "B", category: "us" as const, continuesStoryId: "a" },
      { id: "c", date: "3", title: "C", category: "us" as const, continuesStoryId: "b" },
    ];
    expect(historyChain("c", h).map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(historyChain(undefined, h)).toEqual([]);
  });
});
