import { getJson, listPaths, paths } from "@/lib/storage";
import type { Episode } from "@/lib/types";

/** Episode manifests, newest made first (several versions of one run each have their own episode). */
export async function listEpisodes(limit = 60): Promise<Episode[]> {
  // Ids start with the date (old ids: date-hash; new: runId-a{n}), so the newest few hundred are the last ones.
  const ids = (await listPaths("episodes/"))
    .filter((p) => p.endsWith(".json"))
    .map((p) => p.slice("episodes/".length, -".json".length))
    .sort()
    .reverse()
    .slice(0, Math.max(limit, 200));
  const eps = await Promise.all(ids.map((id) => getJson<Episode>(paths.episode(id))));
  return eps
    .filter((e): e is Episode => !!e)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

/** "v2 · script v3" style label, or "" for episodes made before versions existed. */
export function versionNote(e: Episode): string {
  if (!e.version) return "";
  return `audio v${e.version.audio}${e.version.script ? ` · script v${e.version.script}` : ""}${e.version.analysis ? ` · analysis v${e.version.analysis}` : ""}`;
}

export { formatClock, formatDate } from "./format";
