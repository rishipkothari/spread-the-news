import Link from "next/link";
import { formatDate } from "@/audio/episodes";
import { getJson, paths } from "@/lib/storage";
import type { Episode } from "@/lib/types";
import { Player } from "./Player";

export const dynamic = "force-dynamic";

export default async function EpisodePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const episode = /^[A-Za-z0-9-]+$/.test(id) ? await getJson<Episode>(paths.episode(id)) : null;
  if (!episode) {
    return (
      <main className="player-main">
        <p><Link href="/player">← Episodes</Link></p>
        <h1>Episode not found</h1>
      </main>
    );
  }
  return (
    <main className="player-main">
      <p className="muted"><Link href="/player">← Episodes</Link></p>
      <h1>{formatDate(episode.date)}</h1>
      <Player
        episode={{ id: episode.id, date: episode.date, title: formatDate(episode.date), durationSec: episode.durationSec, chapters: episode.chapters }}
        src={`/audio/${episode.audioPath}?v=${encodeURIComponent(episode.createdAt)}`}
      />
      {episode.missing.length > 0 && (
        <p className="warn" style={{ fontSize: 13 }}>Left out (couldn&apos;t be voiced): {episode.missing.map((m) => m.title).join(", ")}</p>
      )}
      <p className="muted" style={{ fontSize: 12, marginTop: 24 }}>
        Voice {episode.voice} ({episode.provider}) · made from run <Link href={`/debug/runs/${episode.runId}`}>{episode.runId}</Link> · <Link href={`/debug/runs/${episode.runId}/script`}>script</Link>
      </p>
    </main>
  );
}
