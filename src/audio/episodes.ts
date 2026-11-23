import { getJson, listPaths, paths } from "@/lib/storage";
import type { Episode } from "@/lib/types";

/** Episode manifests, newest first. */
export async function listEpisodes(limit = 60): Promise<Episode[]> {
  const ids = (await listPaths("episodes/"))
    .filter((p) => p.endsWith(".json"))
    .map((p) => p.slice("episodes/".length, -".json".length))
    .sort()
    .reverse()
    .slice(0, limit);
  const eps = await Promise.all(ids.map((id) => getJson<Episode>(paths.episode(id))));
  return eps.filter((e): e is Episode => !!e).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export { formatClock, formatDate } from "./format";
