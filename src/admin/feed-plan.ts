import type { Prominence, Source } from "@/lib/types";
import type { FeedProbe, SourceDiscovery } from "./discover";

/** Best guess of a discovered feed's type and section from its URL (the user can change both). */
export function guessType(url: string): { prominence: Prominence; section?: string } {
  // Judge by the path only: a host like "newsnationnow.com" shouldn't read as a section word.
  let u = url.toLowerCase();
  try {
    const p = new URL(url);
    u = (p.pathname + p.search).toLowerCase();
  } catch {
    /* keep the whole string */
  }
  if (/top|front|home|headline/.test(u)) return { prominence: "top" };
  // A topic word anywhere in the path ("/world/feed/") makes it a section feed, even when it ends in /feed/.
  const section = /world|international/.test(u) ? "world" : /politic|\/us\b|us\.xml|us-news|national|congress/.test(u) ? "us" : /business|econom|money|market/.test(u)
    ? "business" : /science|health|tech|environment|climate/.test(u) ? "science" : /sport/.test(u) ? "sports" : /entertain|culture|lifestyle|arts/.test(u) ? "other" : undefined;
  if (section) return { prominence: "section", section };
  if (/latest|all|feed|rss|index\.xml|newsfront/.test(u)) return { prominence: "latest" };
  return { prominence: "section" };
}

/** Same feed regardless of http/https, case of host, or a trailing slash. */
export function feedKey(url: string): string {
  return url.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "").toLowerCase();
}

/** Comment feeds, per-author feeds and similar never carry an outlet's news. */
const NOT_NEWS = /\/comments?\/|\/author\/|\/podcasts?\b|\/video\b|\/feeds?\/(?:posts\/)?comments/i;

export interface FoundFeeds {
  /** Working, not configured, with articles in the last 24 h, not a comments/author feed: what "Add all" adds. */
  active: FeedProbe[];
  /** Working but quiet (no articles in the last 24 h) or likely not news: shown, added only one by one. */
  quiet: FeedProbe[];
  broken: FeedProbe[];
}

export function foundFeeds(source: Source, disc: SourceDiscovery | null): FoundFeeds {
  const configured = new Set(source.feeds.map((f) => feedKey(f.url)));
  const seen = new Set<string>();
  const out: FoundFeeds = { active: [], quiet: [], broken: [] };
  for (const p of disc?.probes ?? []) {
    const key = feedKey(p.url);
    if (configured.has(key) || seen.has(key)) continue;
    seen.add(key);
    if (!p.ok) out.broken.push(p);
    else if (p.inWindow > 0 && !NOT_NEWS.test(p.url)) out.active.push(p);
    else out.quiet.push(p);
  }
  return out;
}
