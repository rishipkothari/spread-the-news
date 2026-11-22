import { describe, expect, it } from "vitest";
import { annotateHomepageRanks, extractArticleLinks, looksLikeArticle } from "@/stages/fetch/homepage";
import { findFeedLinks } from "@/admin/discover";
import type { Article } from "@/lib/types";

const html = `
<nav><a href="/politics">Politics</a><a href="/news/world">World</a><a href="/tag/senate">Senate</a></nav>
<a href="https://www.bbc.com/news/articles/c0lz1x2y3z4o">Lead</a>
<a href="/politics/senate-passes-stopgap-funding-bill-late-friday?utm_source=home">Second</a>
<a href="/politics/senate-passes-stopgap-funding-bill-late-friday">dup</a>
<a href="/homenews/senate/5012345-short">Hill style</a>
<a href="/images/photo.jpg">img</a>`;

describe("homepage prominence", () => {
  it("keeps article-like links in order, skips nav and dupes", () => {
    expect(extractArticleLinks(html, "https://www.example.com/")).toEqual([
      "/news/articles/c0lz1x2y3z4o",
      "/politics/senate-passes-stopgap-funding-bill-late-friday",
      "/homenews/senate/5012345-short",
    ]);
    expect(looksLikeArticle("/news/world")).toBe(false);
  });

  it("matches articles by path across host variants", () => {
    const art = (id: string, url: string): Article => ({ id, sourceId: "bbc", url, title: "", feedCategories: [], prominence: "latest", publishedAt: "" });
    const arts = [art("a", "https://www.bbc.co.uk/news/articles/c0lz1x2y3z4o"), art("b", "https://www.bbc.co.uk/news/articles/other12345")];
    const matched = annotateHomepageRanks(arts, { bbc: { links: extractArticleLinks(html, "https://www.bbc.com/") } });
    expect(arts[0].homepageRank).toBe(1);
    expect(arts[1].homepageRank).toBeUndefined();
    expect(matched).toEqual({ bbc: 1 });
  });
});

describe("feed discovery", () => {
  it("finds advertised and linked feeds", () => {
    const page = `<head><link rel="alternate" type="application/rss+xml" title="All" href="/feed/"></head>
      <a href="https://moxie.foxnews.com/google-publisher/world.xml">World RSS</a><a href="/about/rss">RSS index</a><a href="/politics">x</a>`;
    expect(findFeedLinks(page, "https://www.foxnews.com/").map((l) => [l.url, l.via])).toEqual([
      ["https://www.foxnews.com/feed/", "homepage <link>"],
      ["https://moxie.foxnews.com/google-publisher/world.xml", "page link"],
      ["https://www.foxnews.com/about/rss", "page link"],
    ]);
  });
});
