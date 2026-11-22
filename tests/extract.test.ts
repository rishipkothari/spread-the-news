import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assessText, chainV1Extractor, readabilityText } from "@/stages/extract/chain-v1";
import type { Article, Source } from "@/lib/types";

const page = (name: string) => readFileSync(new URL(`./fixtures/pages/${name}`, import.meta.url), "utf8");
const art = (over: Partial<Article> = {}): Article => ({
  id: "a1", sourceId: "thehill", url: "https://example.com/politics/senate-passes-stopgap", title: "Senate passes stopgap",
  summary: "The Senate voted late Friday.", feedCategories: [], prominence: "latest", publishedAt: "2026-11-22T00:00:00Z", ...over,
});
const source = {} as Source;

function mockFetch(routes: Record<string, { status?: number; body: string; type?: string }>) {
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
    const url = String(input);
    const r = Object.entries(routes).find(([k]) => url.includes(k))?.[1];
    if (!r) return new Response("not found", { status: 404 });
    return new Response(r.body, { status: r.status ?? 200, headers: { "content-type": r.type ?? "text/html; charset=utf-8" } });
  }));
}

afterEach(() => vi.unstubAllGlobals());

describe("text quality check", () => {
  it("grades by length and paywall phrases", () => {
    expect(assessText("x".repeat(900)).status).toBe("full");
    expect(assessText("x".repeat(400)).status).toBe("partial");
    expect(assessText("short").status).toBe("reject");
    expect(assessText(`${"y".repeat(500)} Subscribe to continue reading`).status).toBe("partial");
    expect(assessText("Subscribe to continue reading").status).toBe("reject");
  });
});

describe("readability", () => {
  it("extracts article paragraphs and drops nav, sidebar and footer", () => {
    const text = readabilityText(page("article.html"), "https://example.com/x")!;
    expect(text).toContain("The Senate voted 60 to 38 late Friday");
    expect(text).toContain('"This is not the bill any of us would have written');
    expect(text).not.toContain("Most read");
    expect(text).not.toContain("All rights reserved");
    expect(text.split("\n\n").length).toBeGreaterThanOrEqual(5);
  });
});

describe("extractor chain", () => {
  it("uses the feed's full text when it passes the quality check", async () => {
    mockFetch({});
    const t = await chainV1Extractor.extract(art({ feedText: "Body sentence. ".repeat(80) }), source);
    expect(t).toMatchObject({ textStatus: "full", extractor: "feed-content" });
  });

  it("falls back to fetching the page", async () => {
    mockFetch({ "/robots.txt": { status: 404, body: "" }, "/politics/": { body: page("article.html") } });
    const t = await chainV1Extractor.extract(art({ feedText: "too short" }), source);
    expect(t).toMatchObject({ textStatus: "full", extractor: "readability" });
    expect(t.text).toContain("$12 billion in disaster aid");
  });

  it("marks paywalled pages partial", async () => {
    mockFetch({ "/robots.txt": { status: 404, body: "" }, "/politics/": { body: page("paywall.html") } });
    const t = await chainV1Extractor.extract(art(), source);
    expect(t.textStatus === "partial" || t.textStatus === "headline_only").toBe(true);
    expect(t.error).toMatch(/paywall|short/);
  });

  it("honors robots.txt and falls back to the RSS summary", async () => {
    mockFetch({ "/robots.txt": { body: "User-agent: *\nDisallow: /politics/", type: "text/plain" }, "/politics/": { body: page("article.html") } });
    const t = await chainV1Extractor.extract(art({ url: "https://blocked.example.org/politics/x" }), source);
    expect(t).toMatchObject({ textStatus: "headline_only", extractor: "rss-summary", text: "The Senate voted late Friday." });
    expect(t.error).toContain("robots.txt");
  });

  it("reports HTTP failures", async () => {
    mockFetch({ "/robots.txt": { status: 404, body: "" }, "/politics/": { status: 403, body: "denied" } });
    const t = await chainV1Extractor.extract(art({ url: "https://forbidden.example.net/politics/x" }), source);
    expect(t.textStatus).toBe("headline_only");
    expect(t.error).toContain("HTTP 403");
  });
});
