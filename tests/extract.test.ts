import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assessText, chainExtractor, defuddleText, jsonLdText, readabilityText } from "@/stages/extract/chain";
import type { Article, Source } from "@/lib/types";

const page = (name: string) => readFileSync(new URL(`./fixtures/pages/${name}`, import.meta.url), "utf8");
const art = (over: Partial<Article> = {}): Article => ({
  id: "a1", sourceId: "dailybeast", url: "https://example.com/politics/senate-passes-stopgap", title: "Senate passes stopgap",
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

describe("other page extractors", () => {
  it("reads schema.org JSON-LD articleBody (incl. @graph)", () => {
    const body = "First paragraph of the article. ".repeat(40);
    const html = `<html><head><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},{"@type":"NewsArticle","headline":"H","articleBody":"${body} &amp; more"}]}</script></head><body></body></html>`;
    const t = jsonLdText(html)!;
    expect(t.startsWith("First paragraph")).toBe(true);
    expect(t).toContain("& more");
    expect(jsonLdText("<script type=\"application/ld+json\">{bad json</script>")).toBeUndefined();
  });

  it("Defuddle extracts the article body", () => {
    const text = defuddleText(page("article.html"), "https://example.com/x")!;
    expect(text).toContain("$12 billion in disaster aid");
    expect(text).not.toContain("All rights reserved");
  });
});

describe("extractor chain", () => {
  it("skips page fetches for outlets that block bots", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const t = await chainExtractor.extract(art({ sourceId: "thehill" }), source);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(t).toMatchObject({ textStatus: "headline_only", extractor: "rss-summary" });
    expect(t.error).toContain("blocks automated requests");
  });

  it("prefers JSON-LD when the page has it", async () => {
    const body = "Structured body sentence. ".repeat(50);
    mockFetch({ "/robots.txt": { status: 404, body: "" }, "/politics/": { body: `<html><head><script type="application/ld+json">{"@type":"NewsArticle","articleBody":"${body}"}</script></head><body><p>x</p></body></html>` } });
    const t = await chainExtractor.extract(art({ url: "https://jsonld.example.com/politics/x" }), source);
    expect(t).toMatchObject({ textStatus: "full", extractor: "json-ld" });
  });

  it("uses the feed's full text when it passes the quality check", async () => {
    mockFetch({});
    const t = await chainExtractor.extract(art({ feedText: "Body sentence. ".repeat(80) }), source);
    expect(t).toMatchObject({ textStatus: "full", extractor: "feed-content" });
  });

  it("falls back to fetching the page", async () => {
    mockFetch({ "/robots.txt": { status: 404, body: "" }, "/politics/": { body: page("article.html") } });
    const t = await chainExtractor.extract(art({ feedText: "too short" }), source);
    expect(t).toMatchObject({ textStatus: "full", extractor: "readability" });
    expect(t.text).toContain("$12 billion in disaster aid");
  });

  it("marks paywalled pages partial", async () => {
    mockFetch({ "/robots.txt": { status: 404, body: "" }, "/politics/": { body: page("paywall.html") } });
    const t = await chainExtractor.extract(art(), source);
    expect(t.textStatus === "partial" || t.textStatus === "headline_only").toBe(true);
    expect(t.error).toMatch(/paywall|short/);
  });

  it("honors robots.txt and falls back to the RSS summary", async () => {
    mockFetch({ "/robots.txt": { body: "User-agent: *\nDisallow: /politics/", type: "text/plain" }, "/politics/": { body: page("article.html") } });
    const t = await chainExtractor.extract(art({ url: "https://blocked.example.org/politics/x" }), source);
    expect(t).toMatchObject({ textStatus: "headline_only", extractor: "rss-summary", text: "The Senate voted late Friday." });
    expect(t.error).toContain("robots.txt");
  });

  it("reports HTTP failures", async () => {
    mockFetch({ "/robots.txt": { status: 404, body: "" }, "/politics/": { status: 403, body: "denied" } });
    const t = await chainExtractor.extract(art({ url: "https://forbidden.example.net/politics/x" }), source);
    expect(t.textStatus).toBe("headline_only");
    expect(t.error).toContain("page fetch: HTTP 403");
  });
});

describe("trafilatura link", () => {
  it("endpoint: explicit URL wins, else the production domain, else none", async () => {
    const { trafilaturaEndpoint } = await import("@/stages/extract/chain");
    expect(trafilaturaEndpoint({ TRAFILATURA_URL: "http://x/api/t", VERCEL_PROJECT_PRODUCTION_URL: "p.app" })).toBe("http://x/api/t");
    expect(trafilaturaEndpoint({ VERCEL_PROJECT_PRODUCTION_URL: "p.app" })).toBe("https://p.app/api/trafilatura");
    expect(trafilaturaEndpoint({})).toBeUndefined();
  });

  it("uses Trafilatura's text when it's full, before Readability", async () => {
    vi.stubEnv("TRAFILATURA_URL", "https://fn.test/api/trafilatura");
    const long = "Trafilatura found this paragraph. ".repeat(40);
    mockFetch({
      "robots.txt": { body: "", type: "text/plain" },
      "fn.test/api/trafilatura": { body: JSON.stringify({ text: long, version: "2.4.0" }), type: "application/json" },
      "example.com/politics": { body: page("article.html") },
    });
    const t = await chainExtractor.extract(art(), source);
    expect(t.extractor).toBe("trafilatura");
    expect(t.textStatus).toBe("full");
    vi.unstubAllEnvs();
  });

  it("falls through to Readability when the function is down", async () => {
    vi.stubEnv("TRAFILATURA_URL", "https://fn.test/api/trafilatura");
    mockFetch({
      "robots.txt": { body: "", type: "text/plain" },
      "fn.test/api/trafilatura": { status: 500, body: "boom" },
      "example.com/politics": { body: page("article.html") },
    });
    const t = await chainExtractor.extract(art(), source);
    expect(t.extractor).not.toBe("trafilatura");
    expect(t.text).toContain("The Senate voted 60 to 38");
    vi.unstubAllEnvs();
  });
});
