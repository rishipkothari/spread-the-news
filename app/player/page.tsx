import Link from "next/link";
import { formatClock, formatDate, listEpisodes } from "@/audio/episodes";

export const dynamic = "force-dynamic";

export default async function PlayerHome() {
  const episodes = await listEpisodes();
  return (
    <main className="player-main">
      <h1>Episodes</h1>
      {episodes.length === 0 && (
        <p className="muted">No episodes yet. Open a run with a finished script on the <Link href="/debug/runs">Runs</Link> page and press &quot;Make audio&quot;.</p>
      )}
      <div className="ep-list">
        {episodes.map((e, i) => (
          <Link key={e.id} href={`/player/${e.id}`} className="ep-card">
            <div className="ep-date">{formatDate(e.date)}{i === 0 ? <span className="pill" style={{ marginLeft: 8 }}>latest</span> : null}</div>
            <div className="muted">
              {formatClock(e.durationSec)} · {e.chapters.filter((c) => c.kind === "story").length} stories
            </div>
            <div className="ep-titles">{e.chapters.filter((c) => c.kind === "story").slice(0, 3).map((c) => c.title).join(" · ")}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
