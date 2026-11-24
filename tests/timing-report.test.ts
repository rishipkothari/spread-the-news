import { describe, expect, it } from "vitest";
import { buildTimingReport } from "@/review/timing-report";
import type { RunStatus } from "@/pipeline/status";

describe("timing report", () => {
  it("lists each run step with elapsed time, tokens and cost, and a total", () => {
    const status = {
      runId: "r1", createdAt: "", updatedAt: "", state: "done", params: {}, methods: {}, errors: [],
      stages: {
        fetch: { state: "done", startedAt: "2026-11-24T00:00:00Z", finishedAt: "2026-11-24T00:00:02Z", summary: { articles: 600 } },
        cluster: { state: "done", startedAt: "2026-11-24T00:00:02Z", finishedAt: "2026-11-24T00:00:40Z" },
        extract: { state: "skipped" },
      },
    } as unknown as RunStatus;
    const r = buildTimingReport(status, [{ stage: "cluster", ms: 38000, inputTokens: 80000, outputTokens: 7000, costUsd: 0.23 }], { sources: 27, okSources: 26, articles: 600 });
    expect(r).toContain("sources ok 26/27 | articles 600");
    expect(r).toContain("fetch | done | 2.0s");
    expect(r).toContain("cluster | done | 38.0s |  | 80000/7000 | $0.2300");
    expect(r).not.toContain("extract");
    expect(r).toContain("total: 40.0s elapsed");
  });
});
