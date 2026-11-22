import { describe, expect, it } from "vitest";
import fixture from "./fixtures/bundle-synthetic.json";
import { rankStories } from "@/stages/rank/headline-index-v1";
import { buildReport } from "@/review/report";
import { emptyReview } from "@/review/types";
import type { Article, Source, SourceHealth, Story, StoryBundle } from "@/lib/types";
import { vanillaParams } from "@/lib/config";

describe("review report", () => {
  const stories = rankStories({
    stories: fixture.stories as Story[], articles: fixture.articles as Article[], sources: fixture.sources as Source[],
    sourceHealth: fixture.sourceHealth as SourceHealth, windowEnd: fixture.window.end,
  });
  const bundle: StoryBundle = {
    runId: "test-run", createdAt: fixture.window.end, window: fixture.window, params: vanillaParams(), methods: { rank: "headline-index-v1" },
    sources: fixture.sources as Source[], sourceHealth: fixture.sourceHealth as SourceHealth, articles: fixture.articles as Article[], stories,
  };

  it("includes verdicts, failures and flagged unranked stories", () => {
    const review = emptyReview("test-run");
    review.overall = 4;
    review.missing = "Fed decision";
    review.stories.universal = { verdicts: ["good"] };
    review.stories["right-only"] = { verdicts: ["too_high"], note: "one-sided" };
    review.shouldRank = ["too-small"];
    const text = buildReport(bundle, [{ stage: "cluster", ms: 42000, inputTokens: 30000, outputTokens: 5000, costUsd: 0.11 }], review, ["w1"]);
    expect(text).toContain("overall match to today's real headlines: 4/5");
    expect(text).toContain("missing/underranked: Fed decision");
    expect(text).toMatch(/1\. \[[\d.]+\] Senate passes stopgap funding bill/);
    expect(text).toContain("REVIEW: Ranked too high — note: one-sided");
    expect(text).toContain("Breitbart (stale feed)");
    expect(text).toContain("Local zoning dispute");
    expect(text).toContain("cluster 42s 30000 in/5000 out $0.110");
  });
});
