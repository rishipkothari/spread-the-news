import { describe, expect, it } from "vitest";
import { validateClusterOutput } from "@/stages/cluster/llm-single-pass";
import { buildClusterUser } from "@/stages/cluster/prompt";
import { staticSources } from "@/lib/config";
import type { Article, HistoryStory } from "@/lib/types";

const art = (i: number, sourceId: string): Article => ({
  id: `id${i}`, sourceId, url: `https://x/${i}`, title: `Title ${i}`, summary: `Summary ${i}`,
  feedCategories: ["Politics"], prominence: "section", publishedAt: "2026-11-22T00:00:00Z",
});
const articles = [art(1, "fox"), art(2, "bbc"), art(3, "huffpost"), art(4, "thehill")];
const history: HistoryStory[] = [{ id: "s-prev", date: "2026-11-21", title: "Earlier story", category: "us" }];

describe("cluster validation", () => {
  it("maps ids, drops unknown and duplicate ids, links history", () => {
    const res = validateClusterOutput(
      {
        stories: [
          { title: " A ", category: "us", continuesStoryId: "h1", articles: [{ id: 1, type: "news" }, { id: 2, type: "opinion" }, { id: 99, type: "news" }] },
          { title: "B", category: "world", secondaryCategory: "world", articles: [{ id: 2, type: "news" }, { id: 3, type: "analysis" }] },
          { title: "C", category: "other", continuesStoryId: "h7", articles: [{ id: 42, type: "news" }] },
        ],
      },
      articles,
      history,
    );
    expect(res.stories).toHaveLength(2);
    expect(res.stories[0]).toMatchObject({ title: "A", articleIds: ["id1", "id2"], continuesStoryId: "s-prev" });
    expect(res.stories[1].articleIds).toEqual(["id3"]);
    expect(res.stories[1].secondaryCategory).toBeUndefined();
    expect(res.articleTypes).toEqual({ id1: "news", id2: "opinion", id3: "analysis" });
    expect(res.warnings.length).toBe(4);
  });

  it("builds a compact prompt with 1-based ids and history keys", () => {
    const user = buildClusterUser(articles, staticSources, history);
    expect(user).toContain("1 | Fox News | tags:Politics | Title 1 — Summary 1");
    expect(user).toContain("h1 | 2026-11-21 | us | Earlier story");
  });
});

describe("cluster prompt sections", () => {
  it("lists every section label, and reads older single-section articles", () => {
    const a = (over: Partial<Article>): Article => ({ id: "x", sourceId: "nypost", url: "u", title: "US imposes tariffs on China", feedCategories: [], prominence: "section", publishedAt: "2026-11-23T10:00:00Z", ...over });
    const user = buildClusterUser([a({ sections: ["us", "world"] }), a({ section: "business" })], staticSources, []);
    expect(user).toContain("section:us, world");
    expect(user).toContain("section:business");
  });
});
