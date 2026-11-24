import { beforeEach, describe, expect, it, vi } from "vitest";

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

const { activateVersion, finishPhaseIfLast, prepareRerun, readVersions, versionedPath } = await import("@/pipeline/versions");
const { episodeIdFor } = await import("@/pipeline/phase3");

const id = "2026-11-23T0146-abc123";
const R = `runs/${id}/`;

function seed() {
  store.clear();
  store.set(`${R}status.json`, {
    runId: id, state: "done", params: {}, methods: {}, errors: [],
    stages: {
      synthesize: { state: "done", summary: { syntheses: 7 } },
      plan: { state: "done", summary: { stories: 5 } },
      script: { state: "done", summary: { stories: 5, dropped: 0, minutes: 15 } },
    },
  });
  store.set(`${R}synthesize.json`, { syntheses: ["A1"] });
  store.set(`${R}analysis-plan.json`, { storyIds: ["s1"] });
  store.set(`${R}plan.json`, { stories: ["first plan"] });
  store.set(`${R}script.json`, { segments: ["first script"] });
  store.set(`${R}script/s1.json`, { text: "first unit" });
  store.set(`${R}script-review.json`, { notes: "review of first script" });
}

describe("versions", () => {
  beforeEach(seed);

  it("a run from before versions keeps its finished output as v1 when re-run, and the review doesn't carry over", async () => {
    await prepareRerun(id, "script");
    const v = await readVersions(id);
    expect(v.script.map((x) => x.n)).toEqual([1]);
    expect(v.script[0].legacy).toBe(true);
    expect(v.analysis.map((x) => x.n)).toEqual([1]); // the analysis it was built on is saved too
    expect(v.script[0].basedOn).toEqual({ analysis: 1 });
    expect(store.get(`runs/${id}/versions/script/1/script.json`)).toEqual({ segments: ["first script"] });
    expect(store.get(`runs/${id}/versions/script/1/script/s1.json`)).toEqual({ text: "first unit" });
    expect(store.get(`runs/${id}/versions/script/1/script-review.json`)).toEqual({ notes: "review of first script" });
    expect(store.get(`${R}script-review.json`)).toBeNull();
  });

  it("a finished re-run becomes v2 and current; v1 can be made current again with its review", async () => {
    await prepareRerun(id, "script");
    store.set(`${R}plan.json`, { stories: ["second plan"] });
    store.set(`${R}script.json`, { segments: ["second script"] });
    store.set(`${R}script/s1.json`, { text: "second unit" });
    await finishPhaseIfLast(id, "plan"); // not the last stage: nothing saved
    expect((await readVersions(id)).script).toHaveLength(1);
    await finishPhaseIfLast(id, "script");
    let v = await readVersions(id);
    expect(v.script.map((x) => x.n)).toEqual([1, 2]);
    expect(v.active.script).toBe(2);

    store.set(`${R}script-review.json`, { notes: "review of second script" });
    await activateVersion(id, "script", 1);
    v = await readVersions(id);
    expect(v.active.script).toBe(1);
    expect(store.get(`${R}script.json`)).toEqual({ segments: ["first script"] });
    expect(store.get(`${R}script/s1.json`)).toEqual({ text: "first unit" });
    expect(store.get(`${R}script-review.json`)).toEqual({ notes: "review of first script" });
    // v2's review was synced into its snapshot before switching
    expect(store.get(`runs/${id}/versions/script/2/script-review.json`)).toEqual({ notes: "review of second script" });

    await activateVersion(id, "script", 2);
    expect(store.get(`${R}script-review.json`)).toEqual({ notes: "review of second script" });
  });

  it("viewing paths: current version reads working files, others their snapshot", async () => {
    await prepareRerun(id, "script");
    const v = await readVersions(id);
    expect(versionedPath(id, "script.json", "script", 1, v)).toBe(`${R}script.json`);
    expect(versionedPath(id, "script.json", "script", 3, v)).toBe(`runs/${id}/versions/script/3/script.json`);
    expect(versionedPath(id, "script.json", "script", null, v)).toBe(`${R}script.json`);
  });

  it("each audio version has its own episode id", () => {
    expect(episodeIdFor(id, 1)).not.toBe(episodeIdFor(id, 2));
    expect(episodeIdFor(id, 2)).toBe(`${id}-a2`);
  });
});
