import { XMLParser } from "fast-xml-parser";
import { sha } from "@/lib/hash";
import { PROMINENCE_ORDER, type Article, type Feed } from "@/lib/types";
import { decodeEntities, htmlToText, truncate } from "./text";

const TRACKING_PARAMS = /^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$|cmpid$|ref$|source$|taid$|intcmp$)/i;

export function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.protocol = "https:";
    u.hostname = u.hostname.toLowerCase();
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) u.pathname = u.pathname.slice(0, -1);
    return u.toString();
  } catch {
    return raw.trim();
  }
}

/** Parse a feed date; cap future dates at `now`. Returns null when unparseable. */
export function normalizeDate(raw: unknown, now: Date): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  let d = new Date(raw.trim());
  if (Number.isNaN(d.getTime())) {
    // Some feeds use "Sat, 22 Nov 2026 04:12:00 EST" style zones Date can't parse everywhere.
    const fixed = raw.replace(/\b(EST|EDT|CST|CDT|MST|MDT|PST|PDT)\b/, (z) =>
      ({ EST: "-0500", EDT: "-0400", CST: "-0600", CDT: "-0500", MST: "-0700", MDT: "-0600", PST: "-0800", PDT: "-0700" })[z]!,
    );
    d = new Date(fixed);
    if (Number.isNaN(d.getTime())) return null;
  }
  if (d.getTime() > now.getTime()) d = now;
  return d.toISOString();
}

function textOf(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (Array.isArray(v)) return textOf(v[0]);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return textOf(o["#text"] ?? o["@_href"] ?? "");
  }
  return "";
}

function asArray<T>(v: T | T[] | undefined): T[] {
  return v == null ? [] : Array.isArray(v) ? v : [v];
}

function atomLink(v: unknown): string {
  const links = asArray(v as Record<string, unknown> | Record<string, unknown>[]);
  const alt = links.find((l) => typeof l === "object" && (!l["@_rel"] || l["@_rel"] === "alternate"));
  return textOf(alt ?? links[0]);
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  cdataPropName: false,
  processEntities: true,
  htmlEntities: true,
  trimValues: true,
});

export interface ParsedItem {
  guid?: string;
  url: string;
  title: string;
  summary?: string;
  feedText?: string;
  categories: string[];
  publishedAt: string | null;
}

export function parseFeed(xml: string, now: Date, maxSummaryChars = 400): ParsedItem[] {
  const doc = parser.parse(xml);
  const rssItems = asArray(doc?.rss?.channel?.item ?? doc?.["rdf:RDF"]?.item);
  const atomEntries = asArray(doc?.feed?.entry);
  const out: ParsedItem[] = [];

  for (const it of rssItems as Record<string, unknown>[]) {
    const url = textOf(it.link) || textOf(it.guid);
    const title = htmlToText(decodeEntities(textOf(it.title)));
    if (!url || !title) continue;
    const desc = htmlToText(textOf(it.description));
    const content = htmlToText(textOf(it["content:encoded"]));
    out.push({
      guid: textOf(it.guid) || undefined,
      url,
      title,
      summary: desc ? truncate(desc, maxSummaryChars) : undefined,
      feedText: content || undefined,
      categories: asArray(it.category).map(textOf).map((c) => htmlToText(c)).filter(Boolean),
      publishedAt: normalizeDate(textOf(it.pubDate) || textOf(it["dc:date"]) || textOf(it.published), now),
    });
  }

  for (const it of atomEntries as Record<string, unknown>[]) {
    const url = atomLink(it.link);
    const title = htmlToText(textOf(it.title));
    if (!url || !title) continue;
    const summary = htmlToText(textOf(it.summary));
    const content = htmlToText(textOf(it.content));
    out.push({
      guid: textOf(it.id) || undefined,
      url,
      title,
      summary: summary ? truncate(summary, maxSummaryChars) : undefined,
      feedText: content || undefined,
      categories: asArray(it.category as unknown[]).map((c) => textOf((c as Record<string, unknown>)?.["@_term"] ?? c)).filter(Boolean),
      publishedAt: normalizeDate(textOf(it.published) || textOf(it.updated), now),
    });
  }
  return out;
}

export function toArticle(item: ParsedItem, sourceId: string, feed: Feed, fallbackDate: string): Article {
  const url = canonicalUrl(item.url);
  return {
    id: sha(url),
    sourceId,
    url,
    title: item.title,
    summary: item.summary,
    feedText: item.feedText && item.feedText.length > 600 ? item.feedText : undefined,
    feedCategories: item.categories,
    ...(feed.section ? { sections: [feed.section] } : {}),
    prominence: feed.prominence,
    publishedAt: item.publishedAt ?? fallbackDate,
  };
}

/**
 * Merge duplicate articles (same canonical URL or GUID) within a source.
 * An article seen in several feeds keeps the strongest feed type (top > latest > section) and every feed's section label.
 */
export function dedupe(articles: (Article & { guid?: string })[]): Article[] {
  const byKey = new Map<string, Article>();
  const guidToKey = new Map<string, string>();
  for (const a of articles) {
    const key = `${a.sourceId}|${a.url}`;
    const guidKey = a.guid ? `${a.sourceId}|${a.guid}` : undefined;
    const existingKey = byKey.has(key) ? key : guidKey ? guidToKey.get(guidKey) : undefined;
    const { guid: _g, ...clean } = a;
    if (!existingKey) {
      byKey.set(key, clean);
      if (guidKey) guidToKey.set(guidKey, key);
      continue;
    }
    const prev = byKey.get(existingKey)!;
    byKey.set(existingKey, {
      ...prev,
      prominence: PROMINENCE_ORDER[a.prominence] > PROMINENCE_ORDER[prev.prominence] ? a.prominence : prev.prominence,
      ...(prev.sections || a.sections ? { sections: [...new Set([...(prev.sections ?? []), ...(a.sections ?? [])])] } : {}),
      summary: prev.summary ?? a.summary,
      feedText: prev.feedText ?? a.feedText,
      feedCategories: [...new Set([...prev.feedCategories, ...a.feedCategories])],
      publishedAt: prev.publishedAt < a.publishedAt ? prev.publishedAt : a.publishedAt,
    });
  }
  return [...byKey.values()];
}
