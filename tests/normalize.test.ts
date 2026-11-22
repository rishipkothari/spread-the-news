import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalUrl, normalizeDate, parseFeed } from "@/stages/fetch/normalize";
import { describeBody, processFeeds } from "@/stages/fetch/rss";
import { staticSources } from "@/lib/config";

const rss = readFileSync(new URL("./fixtures/feeds/rss-sample.xml", import.meta.url), "utf8");
const atom = readFileSync(new URL("./fixtures/feeds/atom-sample.xml", import.meta.url), "utf8");
const now = new Date("2026-11-22T06:00:00Z");

describe("normalize", () => {
  it("canonicalizes URLs", () => {
    expect(canonicalUrl("http://Example.com/a/b/?utm_source=x&id=3#frag")).toBe("https://example.com/a/b?id=3");
  });

  it("caps future dates and parses US zones", () => {
    expect(normalizeDate("Mon, 01 Jan 2035 00:00:00 +0000", now)).toBe(now.toISOString());
    expect(normalizeDate("Fri, 21 Nov 2026 20:00:00 EST", now)).toBe("2026-11-22T01:00:00.000Z");
    expect(normalizeDate("garbage", now)).toBeNull();
  });

  it("parses RSS items, entities and categories", () => {
    const items = parseFeed(rss, now);
    expect(items).toHaveLength(5);
    expect(items[0].title).toBe("Senate passes stopgap & funding bill");
    expect(items[0].summary).toBe("The Senate voted 60–38 late Friday.");
    expect(items[0].categories).toEqual(["Politics", "Congress"]);
  });

  it("parses Atom entries", () => {
    const [e] = parseFeed(atom, now);
    expect(e.url).toBe("https://atom.example.org/storm");
    expect(e.categories).toEqual(["Weather"]);
    expect(e.publishedAt).toBe("2026-11-22T01:30:00.000Z");
  });

  it("describes unparseable responses", () => {
    expect(describeBody("<!DOCTYPE html><html>Access denied</html>", "text/html", "https://a/consent", "https://a/feed"))
      .toBe("text/html, 41 bytes; redirected to https://a/consent; starts: <!DOCTYPE html><html>Access denied</html>");
  });

  it("dedupes, windows and reports health", () => {
    const fox = staticSources.find((s) => s.id === "fox")!;
    const bbc = staticSources.find((s) => s.id === "bbc")!;
    const window = { start: "2026-11-21T06:00:00.000Z", end: now.toISOString() };
    const res = processFeeds(
      [
        { source: fox, feedIndex: 0, xml: rss },
        { source: bbc, feedIndex: 0, error: "HTTP 403" },
        { source: bbc, feedIndex: 1, xml: atom },
      ],
      window,
      now,
    );
    const foxArts = res.articles.filter((a) => a.sourceId === "fox");
    // dup by url+guid merged, old item dropped; future item capped and kept
    expect(foxArts.map((a) => a.title)).toEqual(["Article from the future", "Senate passes stopgap & funding bill", "Eastern time item"]);
    expect(res.sourceHealth.fox).toMatchObject({ ok: true, inWindow: 3, items: 4 });
    expect(res.sourceHealth.bbc.ok).toBe(true);
    expect(res.sourceHealth.bbc.feeds?.[0]).toMatchObject({ ok: false, error: "HTTP 403" });
    expect(res.articles.find((a) => a.sourceId === "bbc")?.section).toBe("world");
  });
});
