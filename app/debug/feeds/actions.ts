"use server";

import { revalidatePath } from "next/cache";
import { discoverSource, probeManual, readDiscovery } from "@/admin/discover";
import { CATEGORIES, type Category, type Prominence, type Source } from "@/lib/types";
import { loadSources, resetToRepo, saveSources } from "@/sources/store";

// Behind the password gate in proxy.ts (same as the other /debug pages).

const PROMINENCES: Prominence[] = ["top", "latest", "section"];

function field(fd: FormData, name: string): string {
  return String(fd.get(name) ?? "").trim();
}

async function withSource(sourceId: string, fn: (s: Source, all: Source[]) => string | null): Promise<void> {
  const { sources } = await loadSources();
  const src = sources.find((s) => s.id === sourceId);
  if (!src) throw new Error(`unknown source ${sourceId}`);
  const change = fn(src, sources);
  if (change) await saveSources(sources, change);
  revalidatePath("/debug/feeds");
}

function parseFeedFields(fd: FormData): { prominence: Prominence; section?: Category } {
  const prominence = field(fd, "prominence") as Prominence;
  const section = field(fd, "section") as Category | "";
  if (!PROMINENCES.includes(prominence)) throw new Error(`bad feed type ${prominence}`);
  if (section && !CATEGORIES.includes(section)) throw new Error(`bad section ${section}`);
  return { prominence, section: section || undefined };
}

export async function discoverAction(fd: FormData) {
  const sourceId = field(fd, "sourceId");
  const { sources } = await loadSources();
  const targets = sourceId === "all" ? sources : sources.filter((s) => s.id === sourceId);
  await Promise.all(targets.map((s) => discoverSource(s)));
  revalidatePath("/debug/feeds");
}

export async function testUrlAction(fd: FormData) {
  const sourceId = field(fd, "sourceId");
  const url = field(fd, "url");
  if (!/^https?:\/\//.test(url)) throw new Error("enter a full http(s) URL");
  const { sources } = await loadSources();
  const src = sources.find((s) => s.id === sourceId);
  if (!src) throw new Error(`unknown source ${sourceId}`);
  await probeManual(src, url);
  revalidatePath("/debug/feeds");
}

export async function addFeedAction(fd: FormData) {
  const sourceId = field(fd, "sourceId");
  const url = field(fd, "url");
  const { prominence, section } = parseFeedFields(fd);
  const probe = (await readDiscovery(sourceId))?.probes.find((p) => p.url === url);
  await withSource(sourceId, (src) => {
    if (src.feeds.some((f) => f.url === url)) return null;
    src.feeds.push({ url, prominence, ...(section ? { section } : {}), verified: !!probe?.ok });
    return `${sourceId}: added ${prominence}${section ? `/${section}` : ""} feed ${url}`;
  });
}

export async function updateFeedAction(fd: FormData) {
  const sourceId = field(fd, "sourceId");
  const url = field(fd, "url");
  const { prominence, section } = parseFeedFields(fd);
  await withSource(sourceId, (src) => {
    const f = src.feeds.find((x) => x.url === url);
    if (!f || (f.prominence === prominence && f.section === section)) return null;
    f.prominence = prominence;
    if (section) f.section = section;
    else delete f.section;
    return `${sourceId}: set ${url} to ${prominence}${section ? `/${section}` : ""}`;
  });
}

export async function removeFeedAction(fd: FormData) {
  const sourceId = field(fd, "sourceId");
  const url = field(fd, "url");
  await withSource(sourceId, (src) => {
    const before = src.feeds.length;
    src.feeds = src.feeds.filter((f) => f.url !== url);
    return src.feeds.length < before ? `${sourceId}: removed feed ${url}` : null;
  });
}

export async function toggleSourceAction(fd: FormData) {
  const sourceId = field(fd, "sourceId");
  await withSource(sourceId, (src) => {
    src.enabled = !src.enabled;
    return `${sourceId}: ${src.enabled ? "enabled" : "disabled"}`;
  });
}

export async function resetSourcesAction() {
  await resetToRepo();
  revalidatePath("/debug/feeds");
}
