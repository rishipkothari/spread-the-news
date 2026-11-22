import { config } from "@/lib/config";
import { getJson, putJson } from "@/lib/storage";
import type { Source } from "@/lib/types";
import { extractArticleLinks } from "@/stages/fetch/homepage";
import { parseFeed } from "@/stages/fetch/normalize";
import { checkRobots } from "@/stages/fetch/robots";
import { decodeEntities, htmlToText } from "@/stages/fetch/text";

/** Admin tool: find and test RSS/Atom feeds for a source, from Vercel (which can reach news sites). */

export interface FeedProbe {
  url: string;
  ok: boolean;
  items: number;
  inWindow: number; // items in the last 24h
  newest?: string;
  title?: string;
  samples: string[];
  error?: string;
  foundVia: string; // "configured" | "homepage <link>" | "page link" | "guess" | "manual" | "index page …"
}

export interface SourceDiscovery {
  sourceId: string;
  at: string;
  homepage: { ok: boolean; articleLinks: number; error?: string };
  probes: FeedProbe[];
}

const discoveryPath = (sourceId: string) => `admin/discovery/${sourceId}.json`;

export async function readDiscovery(sourceId: string): Promise<SourceDiscovery | null> {
  return getJson<SourceDiscovery>(discoveryPath(sourceId));
}

async function get(url: string): Promise<{ body: string; contentType: string; finalUrl: string }> {
  const { userAgent } = config.fetch;
  if (!(await checkRobots(url, userAgent, 10_000))) throw new Error("disallowed by robots.txt");
  const res = await fetch(url, { headers: { "user-agent": userAgent }, signal: AbortSignal.timeout(10_000), redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { body: await res.text(), contentType: res.headers.get("content-type") ?? "", finalUrl: res.url || url };
}

const FEEDISH = /(\brss\b|\/feeds?(\/|$)|\.rss$|\.xml$|atom)/i;

/** Feed URLs advertised in <link rel="alternate"> plus feed-looking <a href> links. */
export function findFeedLinks(html: string, baseUrl: string): { url: string; via: string }[] {
  const out = new Map<string, string>();
  const add = (href: string, via: string) => {
    try {
      const abs = new URL(decodeEntities(href), baseUrl).toString();
      if (!out.has(abs)) out.set(abs, via);
    } catch {
      /* ignore bad hrefs */
    }
  };
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/rel\s*=\s*["']?alternate/i.test(tag) || !/(rss|atom)\+xml/i.test(tag)) continue;
    const href = tag.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
    if (href) add(href, "homepage <link>");
  }
  for (const m of html.matchAll(/<a\b[^>]*?href\s*=\s*["']([^"'#]+)["']/gi)) {
    if (FEEDISH.test(m[1]) && !/\.(jpe?g|png|svg)$/i.test(m[1])) add(m[1], "page link");
  }
  return [...out].map(([url, via]) => ({ url, via })).slice(0, 40);
}

export async function probeFeed(url: string, foundVia: string, depth = 0): Promise<FeedProbe[]> {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - config.fetch.windowHours * 3_600_000).toISOString();
  try {
    const { body, contentType, finalUrl } = await get(url);
    const items = parseFeed(body, now);
    if (items.length) {
      const dates = items.map((i) => i.publishedAt).filter((d): d is string => !!d).sort();
      const title = htmlToText(body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").slice(0, 100) || undefined;
      return [{
        url, ok: true, items: items.length, inWindow: dates.filter((d) => d >= dayAgo).length, newest: dates[dates.length - 1],
        title, samples: items.slice(0, 3).map((i) => i.title), foundVia,
      }];
    }
    // An HTML page full of feed links (an "RSS index" page): follow one level.
    if (depth === 0 && /html/i.test(contentType)) {
      const links = findFeedLinks(body, finalUrl).filter((l) => l.url !== url).slice(0, 25);
      if (links.length) {
        const nested = await Promise.all(links.map((l) => probeFeed(l.url, `index page ${url}`, 1)));
        return [{ url, ok: false, items: 0, inWindow: 0, samples: [], error: `HTML page; followed ${links.length} feed links`, foundVia }, ...nested.flat()];
      }
    }
    return [{ url, ok: false, items: 0, inWindow: 0, samples: [], error: `no feed items (${contentType || "unknown type"})`, foundVia }];
  } catch (e) {
    const err = e as Error;
    return [{ url, ok: false, items: 0, inWindow: 0, samples: [], error: err.name === "TimeoutError" ? "timeout" : err.message, foundVia }];
  }
}

export async function discoverSource(source: Source): Promise<SourceDiscovery> {
  const candidates = new Map<string, string>();
  for (const f of source.feeds) candidates.set(f.url, "configured");

  let homepage: SourceDiscovery["homepage"] = { ok: false, articleLinks: 0 };
  try {
    const { body, finalUrl } = await get(source.homepage);
    homepage = { ok: true, articleLinks: extractArticleLinks(body, finalUrl).length };
    for (const l of findFeedLinks(body, finalUrl)) if (!candidates.has(l.url)) candidates.set(l.url, l.via);
  } catch (e) {
    homepage = { ok: false, articleLinks: 0, error: (e as Error).message };
  }
  const origin = new URL(source.homepage).origin;
  for (const guess of ["/feed/", "/rss", "/rss.xml", "/feeds/"]) {
    const u = origin + guess;
    if (!candidates.has(u)) candidates.set(u, "guess");
  }

  const probes = (await Promise.all([...candidates].map(([url, via]) => probeFeed(url, via)))).flat();
  // De-duplicate (index pages can surface a configured feed again), keeping working probes first.
  const byUrl = new Map<string, FeedProbe>();
  for (const p of probes) {
    const prev = byUrl.get(p.url);
    if (!prev || (!prev.ok && p.ok)) byUrl.set(p.url, prev?.foundVia === "configured" ? { ...p, foundVia: "configured" } : p);
  }
  const result: SourceDiscovery = {
    sourceId: source.id,
    at: new Date().toISOString(),
    homepage,
    probes: [...byUrl.values()].sort((a, b) => Number(b.ok) - Number(a.ok) || b.inWindow - a.inWindow),
  };
  await putJson(discoveryPath(source.id), result);
  return result;
}

/** Test one URL by hand and add the result to the source's saved discovery. */
export async function probeManual(source: Source, url: string): Promise<void> {
  const probes = await probeFeed(url, "manual");
  const existing = (await readDiscovery(source.id)) ?? { sourceId: source.id, at: new Date().toISOString(), homepage: { ok: false, articleLinks: 0 }, probes: [] };
  const urls = new Set(probes.map((p) => p.url));
  await putJson(discoveryPath(source.id), { ...existing, probes: [...probes, ...existing.probes.filter((p) => !urls.has(p.url))] });
}
