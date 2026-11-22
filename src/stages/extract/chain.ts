import { Readability } from "@mozilla/readability";
import Defuddle from "defuddle";
import { parseHTML } from "linkedom";
import { config } from "@/lib/config";
import type { Article, ExtractedText, TextStatus } from "@/lib/types";
import { checkRobots } from "../fetch/robots";
import { decodeEntities } from "../fetch/text";
import type { ArticleTextExtractor } from "../types";

/**
 * Extractor chain: the feed's own full text → (one page fetch, unless the outlet blocks bots) → schema.org
 * JSON-LD articleBody → Readability → Defuddle → RSS summary (headline_only). Every candidate passes a
 * quality check (length, paywall phrases); the first "full" wins, otherwise the best "partial".
 */

export interface Assessment {
  status: TextStatus | "reject";
  reason?: string;
}

/** full: long enough and not a paywall stub · partial: some real text but short or truncated by a paywall · reject: unusable. */
export function assessText(text: string | undefined): Assessment {
  const { minTextChars, paywallPhrases } = config.analysis;
  if (!text) return { status: "reject", reason: "empty" };
  const len = text.length;
  const lower = text.toLowerCase();
  const paywall = paywallPhrases.find((p) => lower.includes(p));
  if (paywall && len < minTextChars * 2) {
    return len >= minTextChars / 2 ? { status: "partial", reason: `paywall phrase "${paywall}"` } : { status: "reject", reason: `paywall phrase "${paywall}"` };
  }
  if (len >= minTextChars) return { status: "full" };
  if (len >= 300) return { status: "partial", reason: `short (${len} chars)` };
  return { status: "reject", reason: `too short (${len} chars)` };
}

/** Collapse whitespace but keep paragraph breaks. */
export function cleanText(s: string): string {
  return s
    .replace(/\r/g, "")
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Paragraph-preserving text from an HTML fragment (Readability/Defuddle output). */
export function blocksToText(contentHtml: string): string | undefined {
  const { document: frag } = parseHTML(`<!doctype html><html><body>${contentHtml}</body></html>`);
  const blocks = [...frag.querySelectorAll("p, h2, h3, li, blockquote")].map((el) => (el.textContent ?? "").trim()).filter((t) => t.length > 0);
  if (blocks.length >= 3) return cleanText(blocks.join("\n\n"));
  const all = frag.body?.textContent;
  return all ? cleanText(all) : undefined;
}

const ARTICLE_TYPES = /^(NewsArticle|Article|ReportageNewsArticle|AnalysisNewsArticle|BlogPosting|OpinionNewsArticle|LiveBlogPosting)$/;

/** The articleBody many news sites embed as schema.org JSON-LD for search engines. */
export function jsonLdText(html: string): string | undefined {
  const bodies: string[] = [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object") return;
    const o = node as Record<string, unknown>;
    const types = ([] as unknown[]).concat(o["@type"] ?? []).map(String);
    if (types.some((t) => ARTICLE_TYPES.test(t)) && typeof o.articleBody === "string") bodies.push(o.articleBody);
    if (o["@graph"]) visit(o["@graph"]);
    if (o.mainEntity) visit(o.mainEntity);
  };
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      visit(JSON.parse(m[1].trim()));
    } catch {
      /* malformed JSON-LD is common; skip */
    }
  }
  const best = bodies.sort((a, b) => b.length - a.length)[0];
  if (!best) return undefined;
  // articleBody is sometimes HTML, sometimes text with entities.
  return /<p[\s>]/i.test(best) ? blocksToText(best) : cleanText(decodeEntities(decodeEntities(best)));
}

/** Defuddle (a second, independent content-extraction algorithm). */
export function defuddleText(html: string, url: string): string | undefined {
  const { document } = parseHTML(html);
  const r = new Defuddle(document as unknown as Document, { url }).parse();
  return r.content ? blocksToText(r.content) : undefined;
}

/** Run Readability over an HTML page; returns plain text with paragraph breaks, or undefined. */
export function readabilityText(html: string, url: string): string | undefined {
  const { document } = parseHTML(html);
  // linkedom has no URL on the document; Readability uses it to resolve links only.
  try {
    Object.defineProperty(document, "documentURI", { value: url, configurable: true });
  } catch {
    /* non-fatal */
  }
  const parsed = new Readability(document as unknown as Document, { charThreshold: 300 }).parse();
  if (!parsed) return undefined;
  // Prefer paragraph structure from the cleaned HTML over textContent's run-on text.
  return (parsed.content ? blocksToText(parsed.content) : undefined) ?? (parsed.textContent ? cleanText(parsed.textContent) : undefined);
}

async function fetchPage(url: string): Promise<string> {
  const { userAgent, timeoutMs } = config.fetch;
  if (!(await checkRobots(url, userAgent, timeoutMs))) throw new Error("disallowed by robots.txt");
  const res = await fetch(url, { headers: { "user-agent": userAgent, accept: "text/html,application/xhtml+xml" }, signal: AbortSignal.timeout(timeoutMs), redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get("content-type") ?? "";
  if (type && !/html/i.test(type)) throw new Error(`not HTML (${type})`);
  return res.text();
}

const PAGE_EXTRACTORS: [string, (html: string, url: string) => string | undefined][] = [
  ["json-ld", (html) => jsonLdText(html)],
  ["readability", readabilityText],
  ["defuddle", defuddleText],
];

export const chainExtractor: ArticleTextExtractor = {
  id: "chain-v2",
  async extract(article: Article): Promise<ExtractedText> {
    const base = { articleId: article.id, url: article.url, fetchedAt: new Date().toISOString() };
    const errors: string[] = [];
    let best: { text: string; status: TextStatus; extractor: string } | null = null;
    const consider = (text: string | undefined, extractor: string) => {
      const a = assessText(text);
      if (a.status === "reject") {
        errors.push(`${extractor}: ${a.reason}`);
        return false;
      }
      if (a.reason) errors.push(`${extractor}: ${a.reason}`);
      if (!best || (best.status === "partial" && a.status === "full") || (best.status === a.status && text!.length > best.text.length)) {
        best = { text: text!, status: a.status, extractor };
      }
      return a.status === "full";
    };

    // 1. The feed's own full text (content:encoded).
    if (consider(article.feedText ? cleanText(article.feedText) : undefined, "feed-content")) return finish();

    // 2. Outlets that refuse automated page requests: don't ask (their headlines still count).
    if ((config.analysis.skipPageFetch as string[]).includes(article.sourceId)) {
      errors.push("page fetch skipped: outlet blocks automated requests");
      return finish();
    }

    // 3. Fetch the page once and try each page extractor on it.
    let html: string;
    try {
      html = await fetchPage(article.url);
    } catch (e) {
      const err = e as Error;
      errors.push(`page fetch: ${err.name === "TimeoutError" ? "timeout" : err.message}`);
      return finish();
    }
    for (const [name, fn] of PAGE_EXTRACTORS) {
      let text: string | undefined;
      try {
        text = fn(html, article.url);
      } catch (e) {
        errors.push(`${name}: ${(e as Error).message}`);
        continue;
      }
      if (consider(text, name)) return finish();
    }
    return finish();

    function finish(): ExtractedText {
      const b = best as { text: string; status: TextStatus; extractor: string } | null;
      const error = errors.length ? errors.join("; ") : undefined;
      if (b) return { ...base, text: b.text, textStatus: b.status, extractor: b.extractor, chars: b.text.length, ...(b.status === "full" ? {} : { error }) };
      // 3. Headline only: keep the RSS summary as the best available text.
      return { ...base, text: article.summary, textStatus: "headline_only", extractor: "rss-summary", chars: article.summary?.length ?? 0, error };
    }
  },
};
