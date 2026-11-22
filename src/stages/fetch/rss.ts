import { config } from "@/lib/config";
import type { Article, Source, SourceHealth } from "@/lib/types";
import type { ArticleFetcher, FetchResult, TimeWindow } from "../types";
import { dedupe, parseFeed, toArticle } from "./normalize";
import { annotateHomepageRanks, fetchHomepage, type HomepageResult } from "./homepage";
import { checkRobots } from "./robots";

async function fetchFeed(url: string): Promise<{ xml: string; contentType: string; finalUrl: string }> {
  const { userAgent, timeoutMs } = config.fetch;
  if (!(await checkRobots(url, userAgent, timeoutMs))) throw new Error("disallowed by robots.txt");
  const res = await fetch(url, {
    headers: { "user-agent": userAgent, accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5" },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { xml: await res.text(), contentType: res.headers.get("content-type") ?? "?", finalUrl: res.url };
}

/** Short diagnostic for a response that parsed to zero items (block page, redirect, empty feed). */
export function describeBody(body: string, contentType = "?", finalUrl?: string, requestedUrl?: string): string {
  const snippet = body.replace(/\s+/g, " ").trim().slice(0, 120);
  const redirected = finalUrl && requestedUrl && finalUrl !== requestedUrl ? ` redirected to ${finalUrl};` : "";
  return `${contentType}, ${body.length} bytes;${redirected} starts: ${snippet || "(empty)"}`;
}

/** Pure step after network: parse, normalize, dedupe, window. Exported for fixture tests. */
export function processFeeds(
  results: { source: Source; feedIndex: number; xml?: string; error?: string; contentType?: string; finalUrl?: string }[],
  window: TimeWindow,
  now: Date,
  homepages: Record<string, HomepageResult> = {},
): FetchResult {
  const sourceHealth: SourceHealth = {};
  const all: (Article & { guid?: string })[] = [];

  for (const r of results) {
    const feed = r.source.feeds[r.feedIndex];
    const h = (sourceHealth[r.source.id] ??= { ok: false, items: 0, inWindow: 0, feeds: [] });
    if (r.error || r.xml == null) {
      h.feeds!.push({ url: feed.url, ok: false, items: 0, error: r.error });
      continue;
    }
    try {
      const items = parseFeed(r.xml, now, config.fetch.maxSummaryChars);
      h.feeds!.push({ url: feed.url, ok: items.length > 0, items: items.length, error: items.length ? undefined : `no items parsed — ${describeBody(r.xml, r.contentType, r.finalUrl, feed.url)}` });
      for (const item of items) all.push({ ...toArticle(item, r.source.id, feed, now.toISOString()), guid: item.guid });
    } catch (e) {
      h.feeds!.push({ url: feed.url, ok: false, items: 0, error: `parse error: ${(e as Error).message}` });
    }
  }

  const deduped = dedupe(all);
  const inWindow = deduped
    .filter((a) => a.publishedAt >= window.start && a.publishedAt <= window.end)
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1)); // newest first; Daily Caller orders by score

  const matched = annotateHomepageRanks(inWindow, homepages);
  for (const [id, hp] of Object.entries(homepages)) {
    if (!sourceHealth[id]) continue;
    sourceHealth[id].homepage = { ok: !!hp.links, articleLinks: hp.links?.length ?? 0, matched: matched[id] ?? 0, error: hp.error };
  }

  for (const [id, h] of Object.entries(sourceHealth)) {
    h.items = deduped.filter((a) => a.sourceId === id).length;
    h.inWindow = inWindow.filter((a) => a.sourceId === id).length;
    h.ok = h.inWindow > 0;
    if (!h.ok) {
      const errs = h.feeds!.filter((f) => f.error).map((f) => f.error);
      h.error = errs.length ? errs.join("; ") : h.items > 0 ? `no items in last ${config.fetch.windowHours}h (stale feed)` : "no items";
    }
  }
  return { articles: inWindow, sourceHealth };
}

export const rssFetcher: ArticleFetcher = {
  id: "rss",
  async fetch(sources, window) {
    const jobs = sources.flatMap((source) => source.feeds.map((_, feedIndex) => ({ source, feedIndex })));
    const homepagePromise = config.fetch.homepage
      ? Promise.all(sources.map(async (s) => [s.id, await fetchHomepage(s.homepage)] as const)).then((e) => Object.fromEntries(e))
      : Promise.resolve({});
    const results = await Promise.all(
      jobs.map(async (j) => {
        try {
          return { ...j, ...(await fetchFeed(j.source.feeds[j.feedIndex].url)) };
        } catch (e) {
          const err = e as Error;
          return { ...j, error: err.name === "TimeoutError" ? "timeout" : err.message };
        }
      }),
    );
    return processFeeds(results, window, new Date(window.end), await homepagePromise);
  },
};
