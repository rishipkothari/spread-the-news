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
const started: { stages: string[] }[] = [];
vi.mock("workflow/api", () => ({ start: async (_wf: unknown, [, stages]: [string, string[]]) => (started.push({ stages }), { runId: "wf-1" }) }));
vi.mock("@/workflows/pipeline", () => ({ pipelineWorkflow: () => {} }));

const { createRun, startCreatedRun } = await import("@/pipeline/start");
const { readStatus } = await import("@/pipeline/status");

describe("create run", () => {
  beforeEach(() => { store.clear(); started.length = 0; });

  it("makes the run without starting anything", async () => {
    const s = await createRun();
    expect(s.state).toBe("created");
    expect(started).toHaveLength(0);
    expect(s.stages.sources?.state).toBe("pending");
    expect(s.stages.rank?.state).toBe("pending");
    expect(s.stages.extract?.state).toBe("skipped");
  });

  it("starts discovery, or everything, once", async () => {
    const a = await createRun();
    await startCreatedRun(a.runId, "discovery");
    expect(started[0].stages).toEqual(["sources", "fetch", "cluster", "merge", "rank"]);
    expect((await readStatus(a.runId))?.state).toBe("queued");
    await expect(startCreatedRun(a.runId, "discovery")).rejects.toThrow(/already started/);

    const b = await createRun();
    await startCreatedRun(b.runId, "everything");
    expect(started[1].stages.at(-1)).toBe("assemble");
    expect(started[1].stages).toHaveLength(13);
  });
});
