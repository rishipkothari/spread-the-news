import { config } from "@/lib/config";
import type { Article } from "@/lib/types";
import { decodeEntities } from "./text";
import { checkRobots } from "./robots";

/**
 * Homepage prominence: which of our articles an outlet is featuring on its own
 * homepage right now, and how high up. Matching is by URL path, so host variants
 * (bbc.co.uk vs bbc.com, www vs bare) don't matter.
 */

const NON_ARTICLE = /\.(jpe?g|png|gif|svg|webp|css|js|ico|xml|pdf)$|\/(tag|tags|topic|topics|category|author|authors|section|search|newsletters?|subscribe|account|login)(\/|$)/i;

export function pathKey(url: string): string | null {
  try {
    const u = new URL(url);
    const p = u.pathname.toLowerCase().replace(/\/+$/, "");
    return p || null;
  } catch {
    return null;
  }
}

/** Heuristic: article URLs have a long slug or a long numeric id; section links ("/politics", "/news/world") don't. */
export function looksLikeArticle(path: string): boolean {
  if (NON_ARTICLE.test(path)) return false;
  const segs = path.split("/").filter(Boolean);
  if (!segs.length) return false;
  const last = segs[segs.length - 1];
  return /\d{5,}/.test(path) || (last.length >= 20 && last.includes("-")) || (segs.length >= 2 && last.length >= 8);
}

/** Ordered, de-duplicated article path keys found in a homepage's links. */
export function extractArticleLinks(html: string, baseUrl: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const re = /<a\b[^>]*?\bhref\s*=\s*["']([^"'#]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    let abs: string;
    try {
      abs = new URL(decodeEntities(m[1]), baseUrl).toString();
    } catch {
      continue;
    }
    const key = pathKey(abs);
    if (!key || seen.has(key) || !looksLikeArticle(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

export interface HomepageResult {
  links?: string[];
  error?: string;
}

export async function fetchHomepage(url: string): Promise<HomepageResult> {
  const { userAgent, timeoutMs } = config.fetch;
  try {
    if (!(await checkRobots(url, userAgent, timeoutMs))) return { error: "disallowed by robots.txt" };
    const res = await fetch(url, { headers: { "user-agent": userAgent, accept: "text/html" }, signal: AbortSignal.timeout(timeoutMs), redirect: "follow" });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const links = extractArticleLinks(await res.text(), res.url || url);
    return links.length ? { links } : { error: "no article links found (page may be rendered by JavaScript)" };
  } catch (e) {
    const err = e as Error;
    return { error: err.name === "TimeoutError" ? "timeout" : err.message };
  }
}

/** Set homepageRank on articles whose path appears on their outlet's homepage. Returns matches per source. */
export function annotateHomepageRanks(articles: Article[], homepages: Record<string, HomepageResult>): Record<string, number> {
  const rankBySource = new Map<string, Map<string, number>>();
  for (const [sourceId, hp] of Object.entries(homepages)) {
    if (hp.links) rankBySource.set(sourceId, new Map(hp.links.map((k, i) => [k, i + 1])));
  }
  const matched: Record<string, number> = {};
  for (const a of articles) {
    const ranks = rankBySource.get(a.sourceId);
    const key = pathKey(a.url);
    const rank = ranks && key ? ranks.get(key) : undefined;
    if (rank) {
      a.homepageRank = rank;
      matched[a.sourceId] = (matched[a.sourceId] ?? 0) + 1;
    }
  }
  return matched;
}
