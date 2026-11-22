import { describe, expect, it } from "vitest";
import fixture from "./fixtures/bundle-synthetic.json";
import { normalizedEntropy, rankStories } from "@/stages/rank/headline-index-v1";
import type { Article, Source, SourceHealth, Story } from "@/lib/types";

const input = {
  stories: fixture.stories as Story[],
  articles: fixture.articles as Article[],
  sources: fixture.sources as Source[],
  sourceHealth: fixture.sourceHealth as SourceHealth,
  windowEnd: fixture.window.end,
};

describe("headline index", () => {
  const ranked = rankStories(input);
  const byId = Object.fromEntries(ranked.map((s) => [s.id, s]));

  it("entropy bounds", () => {
    expect(normalizedEntropy([1, 1, 1])).toBeCloseTo(1);
    expect(normalizedEntropy([1, 0, 0])).toBe(0);
  });

  it("ranks universal coverage first", () => {
    expect(ranked[0].id).toBe("universal");
  });

  it("one-sided coverage scores below balanced coverage of similar size", () => {
    expect(byId["right-only"].signals!.skew).toBeGreaterThan(0.6);
    expect(byId["right-only"].headlineIndex).toBeLessThan(byId.universal.headlineIndex);
    expect(byId["right-only"].signals!.balance).toBeLessThan(byId["small-balanced"].signals!.balance);
  });

  it("counts opinion-only outlets at 0.5", () => {
    // left-lean: 4 outlets news + csmonitor opinion-only
    expect(byId["left-lean"].signals!.outletCount).toBe(4.5);
    expect(byId["left-lean"].signals!.distinctOutlets).toBe(5);
  });

  it("uses only active sources in denominators", () => {
    // 11 of 12 active (breitbart failed); universal covers 9.5 weighted outlets
    expect(byId.universal.signals!.coverage).toBeCloseTo(9.5 / 11);
    // failed-source story drops to 2 active outlets and is unranked
    expect(byId["failed-source"].ranked).toBe(false);
    expect(byId["failed-source"].headlineIndex).toBe(0);
  });

  it("applies the minimum-outlet rule", () => {
    expect(byId["too-small"].ranked).toBe(false);
    expect(ranked.filter((s) => s.ranked).every((s) => s.signals!.distinctOutlets >= 3)).toBe(true);
  });

  it("decays with recency", () => {
    expect(byId["old-balanced"].signals!.recency).toBeCloseTo(Math.pow(0.5, 20 / 24), 3);
  });

  it("prominence counts only outlets that have a top feed", () => {
    // universal: huffpost + bbc both have top feeds and both carried it there
    expect(byId.universal.signals!.prominence).toBe(1);
    expect(byId["small-balanced"].signals!.prominence).toBe(0);
  });

  it("skew example from the PRD: 10 left + 1 right ≈ 0.8", () => {
    const sources = input.sources;
    const arts: Article[] = [
      ...Array.from({ length: 10 }, (_, i) => ({ id: `l${i}`, sourceId: ["motherjones", "dailybeast", "thenation", "huffpost"][i % 4], url: "", title: "", feedCategories: [], prominence: "section" as const, publishedAt: input.windowEnd, articleType: "news" as const })),
      { id: "r0", sourceId: "fox", url: "", title: "", feedCategories: [], prominence: "section", publishedAt: input.windowEnd, articleType: "news" },
    ];
    const [s] = rankStories({ ...input, articles: arts, stories: [{ id: "x", title: "x", category: "us", articleIds: arts.map((a) => a.id), headlineIndex: 0 }], sources });
    expect(s.signals!.skew).toBeCloseTo(0.818, 2);
  });
});
