/**
 * Generates tests/fixtures/bundle-synthetic.json: a hand-built StoryBundle (pre-rank)
 * with known coverage patterns, used by ranker tests. Run: npx tsx scripts/make-fixture-bundle.ts
 */
import { writeFileSync } from "node:fs";
import sourcesFile from "../config/sources.json" with { type: "json" };
import type { Article, Source, SourceHealth, Story } from "../src/lib/types";

const sources = sourcesFile.sources as Source[];
const end = "2026-11-22T06:00:00.000Z";
const hoursAgo = (h: number) => new Date(Date.parse(end) - h * 3_600_000).toISOString();
const articles: Article[] = [];
const stories: Story[] = [];
let n = 0;

function story(id: string, title: string, category: Story["category"], cover: [string, Article["articleType"], number?, Article["prominence"]?, number?][]) {
  const ids = cover.map(([sourceId, type, h = 3, prom = "latest", homepageRank]) => {
    const a: Article = {
      id: `a${++n}`, sourceId, url: `https://example.com/${sourceId}/${id}/${n}`, title: `${title} (${sourceId})`,
      feedCategories: [], prominence: prom, publishedAt: hoursAgo(h), articleType: type, ...(homepageRank ? { homepageRank } : {}),
    };
    articles.push(a);
    return a.id;
  });
  stories.push({ id, title, category, articleIds: ids, headlineIndex: 0 });
}

// Universal: 10 outlets across the spectrum, recent, carried in BBC/HuffPost top feeds.
story("universal", "Senate passes stopgap funding bill", "us", [
  ["motherjones", "news"], ["dailybeast", "news"], ["huffpost", "news", 2, "top"], ["thenation", "opinion"],
  ["bbc", "news", 1, "top"], ["thehill", "news"], ["newsnation", "news"], ["fox", "news", 3, "latest", 2], ["dailywire", "news"], ["dailycaller", "news"],
]);
// One-sided: 6 right outlets + 1 center, many articles.
story("right-only", "Border crossing numbers spark debate", "us", [
  ["fox", "news"], ["fox", "opinion"], ["dailywire", "news"], ["dailycaller", "news"], ["dailycaller", "opinion"], ["breitbart", "news"], ["thehill", "news"],
]);
// Left-leaning: 4 left + 1 center opinion.
story("left-lean", "Union drive at warehouse chain", "business", [
  ["motherjones", "news"], ["huffpost", "news"], ["dailybeast", "news"], ["thenation", "news"], ["csmonitor", "opinion"],
]);
// Balanced but small: 1 per group.
story("small-balanced", "Probe lands on asteroid", "science", [["huffpost", "news", 3, "section"], ["bbc", "news", 3, "section"], ["fox", "news", 3, "section"]]);
// Balanced but old (20h).
story("old-balanced", "Supreme Court hears tariff case", "us", [
  ["dailybeast", "news", 20], ["thehill", "news", 20], ["newsnation", "news", 21], ["fox", "news", 22], ["motherjones", "news", 20],
]);
// Below the minimum: 2 outlets.
story("too-small", "Local zoning dispute", "us", [["thehill", "news"], ["newsnation", "news"]]);
// Covered by a failed source: breitbart is unhealthy below, so this has only 2 active outlets.
story("failed-source", "Celebrity trial verdict", "other", [["breitbart", "news"], ["fox", "news"], ["dailywire", "news"]]);

const sourceHealth: SourceHealth = Object.fromEntries(
  sources.map((s) => [s.id, { ok: s.id !== "breitbart", items: 20, inWindow: s.id === "breitbart" ? 0 : 20, error: s.id === "breitbart" ? "stale feed" : undefined }]),
);

writeFileSync(
  new URL("../tests/fixtures/bundle-synthetic.json", import.meta.url),
  JSON.stringify({ window: { start: hoursAgo(24), end }, sources, sourceHealth, articles, stories }, null, 2) + "\n",
);
console.log(`wrote ${stories.length} stories, ${articles.length} articles`);
