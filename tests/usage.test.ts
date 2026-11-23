import { describe, expect, it, vi } from "vitest";

const store = new Map<string, unknown>();
vi.mock("@/lib/storage", async (orig) => {
  const real = await orig<typeof import("@/lib/storage")>();
  return {
    ...real,
    putJson: async (p: string, d: unknown) => void store.set(p, structuredClone(d)),
    getJson: async (p: string) => (store.has(p) ? structuredClone(store.get(p)) : null),
  };
});

const { appendUsage, clearUsage, stageWallMs } = await import("@/pipeline/status");
const { stageUsage } = await import("@/pipeline/phase1");
const { paths } = await import("@/lib/storage");

describe("stage timing and usage", () => {
  it("elapsed time comes from the stage's timestamps, not summed parallel steps", () => {
    const units = Array.from({ length: 15 }, () => ({ ms: 10_000, usage: [] }));
    expect(stageUsage("analyze", units)[0].ms).toBe(150_000); // summed step time: 2.5 min of work…
    expect(stageWallMs({ state: "done", startedAt: "2026-11-23T10:00:00.000Z", finishedAt: "2026-11-23T10:00:12.000Z" })).toBe(12_000); // …in 12s
    expect(stageWallMs({ state: "running", startedAt: "2026-11-23T10:00:00.000Z" })).toBeNull();
  });

  it("re-running a stage replaces its usage instead of adding to it", async () => {
    store.clear();
    await appendUsage("r", [{ stage: "rank", ms: 100 }, { stage: "analyze", ms: 5000, costUsd: 0.1 }]);
    await clearUsage("r", ["analyze"]);
    await appendUsage("r", [{ stage: "analyze", ms: 4000, costUsd: 0.09 }]);
    const usage = store.get(paths.usage("r")) as { stage: string; ms: number }[];
    expect(usage.filter((u) => u.stage === "analyze")).toEqual([{ stage: "analyze", ms: 4000, costUsd: 0.09 }]);
    expect(usage.find((u) => u.stage === "rank")?.ms).toBe(100);
  });
});
