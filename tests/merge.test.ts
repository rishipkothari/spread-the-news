import { describe, expect, it } from "vitest";
import { applyMerges, buildMergeUser } from "@/stages/merge/llm-merge-v1";
import type { Article, Source, Story } from "@/lib/types";

const art = (id: string, sourceId: string, title: string, publishedAt: string): Article => ({
  id, sourceId, url: `https://x/${id}`, title, feedCategories: [], prominence: "latest", publishedAt,
});
const story = (id: string, title: string, articleIds: string[], extra: Partial<Story> = {}): Story => ({ id, title, category: "us", articleIds, headlineIndex: 0, ...extra });

const articles = [
  art("a1", "fox", "Foxx trails by 330 votes, requests recount", "2026-11-22T10:00:00Z"),
  art("a2", "bbc", "Democrats win biggest House majority since 1992", "2026-11-22T11:00:00Z"),
  art("a3", "npr", "House flips after North Carolina count", "2026-11-22T12:00:00Z"),
  art("a4", "nypost", "Foxx concedes to Hubbard", "2026-11-22T20:00:00Z"),
  art("a5", "cbsnews", "Foxx concedes North Carolina race", "2026-11-22T21:00:00Z"),
  art("a6", "vox", "Storm hits Gulf coast", "2026-11-22T09:00:00Z"),
];
const sources: Source[] = ["fox", "bbc", "npr", "nypost", "cbsnews", "vox"].map((id) => ({
  id, name: id.toUpperCase(), homepage: "", feeds: [], lean: "center", leanValue: 0,
  leanProvenance: { source: "allsides", checkedOn: "" }, paywall: "none", fullTextInFeed: false, enabled: true,
}));
const stories = [
  story("s-house", "Democrats win largest House majority", ["a1", "a2", "a3"], { continuesStoryId: "h-old" }),
  story("s-foxx", "Foxx concedes to Hubbard", ["a4", "a5"]),
  story("s-storm", "Storm hits Gulf coast", ["a6"]),
];

describe("merge check", () => {
  it("merges a follow-up into the larger story and keeps the rest", () => {
    const r = applyMerges({ groups: [{ stories: [2, 1], title: "Democrats win House majority; Foxx concedes", reason: "follow-up" }] }, stories);
    expect(r.stories).toHaveLength(2);
    const merged = r.stories[0];
    expect(merged.articleIds.sort()).toEqual(["a1", "a2", "a3", "a4", "a5"]);
    expect(merged.title).toBe("Democrats win House majority; Foxx concedes");
    expect(merged.continuesStoryId).toBe("h-old");
    expect(merged.id).not.toBe("s-house");
    expect(r.stories[1].id).toBe("s-storm");
    expect(r.merges[0].from).toEqual(["s-house", "s-foxx"]);
  });

  it("ignores bad numbers, singletons and repeats", () => {
    const r = applyMerges(
      { groups: [{ stories: [1, 9], title: "x", reason: "" }, { stories: [1, 2], title: "y", reason: "" }, { stories: [2, 3], title: "z", reason: "" }] },
      stories,
    );
    expect(r.merges).toHaveLength(1);
    expect(r.merges[0].title).toBe("y");
    expect(r.stories.map((s) => s.title)).toEqual(["y", "Storm hits Gulf coast"]);
    expect(r.warnings.join(" ")).toMatch(/unknown story number 9/);
    expect(r.warnings.join(" ")).toMatch(/story 2 in two groups/);
  });

  it("no groups = unchanged", () => {
    const r = applyMerges({ groups: [] }, stories);
    expect(r.stories).toEqual(stories);
  });

  it("prompt lists stories with times and newest headlines first", () => {
    const u = buildMergeUser(stories, new Map(articles.map((a) => [a.id, a])), new Map(sources.map((s) => [s.id, s])));
    expect(u).toMatch(/^STORIES/);
    expect(u).toContain("2 | us | 2 outlets, 2 articles | 11-22 20:00 → 11-22 21:00 UTC | Foxx concedes to Hubbard");
    const house = u.split("\n").slice(1, 5).join("\n");
    expect(house.indexOf("NPR")).toBeLessThan(house.indexOf("FOX"));
  });
});
