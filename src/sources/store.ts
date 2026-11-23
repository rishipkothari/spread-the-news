import { staticSources } from "@/lib/config";
import { getJson, putJson } from "@/lib/storage";
import type { Source } from "@/lib/types";

/**
 * The live source list. The repo's config/sources.json is the default; edits made
 * on the admin feeds page are saved to Blob and take precedence from the next run.
 */
const OVERRIDE_PATH = "config/sources.json";
const CHANGELOG_PATH = "config/sources-changelog.json";

export interface SourceList {
  sources: Source[];
  origin: "blob" | "repo";
  updatedAt?: string;
}

interface Stored {
  sources: Source[];
  updatedAt: string;
}

export async function loadSources(): Promise<SourceList> {
  const stored = await getJson<Stored>(OVERRIDE_PATH);
  if (stored?.sources?.length) return { sources: stored.sources, origin: "blob", updatedAt: stored.updatedAt };
  return { sources: structuredClone(staticSources), origin: "repo" };
}

export async function saveSources(sources: Source[], change: string): Promise<void> {
  const updatedAt = new Date().toISOString();
  await putJson(OVERRIDE_PATH, { sources, updatedAt } satisfies Stored);
  const log = (await getJson<{ at: string; change: string }[]>(CHANGELOG_PATH)) ?? [];
  await putJson(CHANGELOG_PATH, [...log, { at: updatedAt, change }].slice(-500));
}

export async function readChangelog(): Promise<{ at: string; change: string }[]> {
  return (await getJson<{ at: string; change: string }[]>(CHANGELOG_PATH)) ?? [];
}

/** Repo sources whose ids aren't in the live list (new defaults added since the list was last edited here). */
export function missingFromRepo(live: Source[]): Source[] {
  const have = new Set(live.map((s) => s.id));
  return staticSources.filter((s) => !have.has(s.id));
}

/** Append new repo sources to the edited live list, keeping every edit already made. */
export async function addMissingFromRepo(): Promise<string[]> {
  const { sources, origin } = await loadSources();
  if (origin === "repo") return [];
  const missing = missingFromRepo(sources);
  if (!missing.length) return [];
  await saveSources([...sources, ...structuredClone(missing)], `added from repo: ${missing.map((s) => s.id).join(", ")}`);
  return missing.map((s) => s.id);
}

/** Drop the Blob override so the repo file is used again. */
export async function resetToRepo(): Promise<void> {
  await putJson(OVERRIDE_PATH, { sources: [], updatedAt: new Date().toISOString() });
  const log = (await getJson<{ at: string; change: string }[]>(CHANGELOG_PATH)) ?? [];
  await putJson(CHANGELOG_PATH, [...log, { at: new Date().toISOString(), change: "reset to repo config/sources.json" }]);
}
