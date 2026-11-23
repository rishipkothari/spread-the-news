import Link from "next/link";
import { formatClock, formatDate, listEpisodes } from "@/audio/episodes";
import { listPaths } from "@/lib/storage";
import { readStatus } from "@/pipeline/status";

export const dynamic = "force-dynamic";

export default async function Home() {
  const files = await listPaths("runs/");
  const ids = [...new Set(files.filter((p) => p.endsWith("/status.json")).map((p) => p.split("/")[1]))].sort().reverse();
  let latestReviewable: string | null = null;
  for (const id of ids.slice(0, 15)) {
    const s = await readStatus(id);
    if (s?.stages.rank?.state === "done") {
      latestReviewable = id;
      break;
    }
  }
  const [latest] = await listEpisodes(1);
  return (
    <main>
      <h1>Spread the News</h1>
      <p className="muted">Daily news read across the spectrum.</p>
      <div style={{ marginTop: 20 }}>
        {latest ? (
          <Link href={`/player/${latest.id}`} className="big">▶ Play {formatDate(latest.date)} ({formatClock(latest.durationSec)}) →</Link>
        ) : null}
        <Link href="/player" className="big">All episodes →</Link>
        <Link href="/debug/runs" className="big">Runs: start a run, see results →</Link>
        {latestReviewable && <Link href={`/debug/runs/${latestReviewable}/review`} className="big">Review latest run →</Link>}
      </div>
    </main>
  );
}
