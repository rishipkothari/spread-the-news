import { describe, expect, it } from "vitest";
import { feedKey, foundFeeds, guessType } from "@/admin/feed-plan";
import type { Source } from "@/lib/types";

describe("feed plan", () => {
  it("guesses types from the path", () => {
    expect(guessType("https://nypost.com/world/feed/")).toEqual({ prominence: "section", section: "world" });
    expect(guessType("https://nypost.com/feed/")).toEqual({ prominence: "latest" });
    expect(guessType("https://www.theguardian.com/us-news/rss")).toEqual({ prominence: "section", section: "us" });
    expect(guessType("https://www.cbsnews.com/latest/rss/main")).toEqual({ prominence: "latest" });
    expect(guessType("https://www.huffpost.com/section/front-page/feed")).toEqual({ prominence: "top" });
    expect(guessType("https://www.newsnationnow.com/feed/")).toEqual({ prominence: "latest" });
  });

  it("splits found feeds into active (batch-addable), quiet and broken, skipping configured ones", () => {
    const source = { id: "x", feeds: [{ url: "https://x.com/feed/", prominence: "latest" }] } as unknown as Source;
    const probe = (url: string, ok: boolean, inWindow: number) => ({ url, ok, items: 10, inWindow, samples: [], foundVia: "guess" });
    const f = foundFeeds(source, {
      sourceId: "x", at: "", homepage: { ok: true, articleLinks: 1 },
      probes: [
        probe("http://x.com/feed", true, 5), // configured (different scheme and slash)
        probe("https://x.com/world/feed/", true, 4),
        probe("https://x.com/comments/feed/", true, 9),
        probe("https://x.com/old/feed/", true, 0),
        probe("https://x.com/rss.xml", false, 0),
      ],
    });
    expect(f.active.map((p) => p.url)).toEqual(["https://x.com/world/feed/"]);
    expect(f.quiet.map((p) => p.url)).toEqual(["https://x.com/comments/feed/", "https://x.com/old/feed/"]);
    expect(f.broken.map((p) => p.url)).toEqual(["https://x.com/rss.xml"]);
    expect(feedKey("HTTPS://X.com/feed/")).toBe(feedKey("http://x.com/feed"));
  });
});
