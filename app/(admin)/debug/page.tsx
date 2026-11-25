import Link from "next/link";
import { formatClock, formatDate, listEpisodes } from "@/audio/episodes";
import { missingEnv } from "@/lib/env";
import { listPaths } from "@/lib/storage";
import { STAGES } from "@/pipeline/stages";
import { readStatus } from "@/pipeline/status";
import { readNewsIndex } from "@/news/store";
import { rebuildNewsAction, startRunAction } from "./actions";

export const dynamic = "force-dynamic";

const TILES = [
  { href: "/debug/runs", title: "Runs", text: "Every pipeline run, its steps and results." },
  { href: "/debug/feeds", title: "Feeds", text: "News sources, their feeds and health." },
  { href: "/debug/voices", title: "Voices", text: "Try text-to-speech voices." },
  { href: "/player", title: "Episodes", text: "Every generated daily episode." },
];

/** Admin console home: start a run, see the latest run and episode, jump anywhere. */
export default async function AdminOverview({ searchParams }: { searchParams: Promise<{ news?: string }> }) {
  const { news } = await searchParams;
  const files = await listPaths("runs/");
  const ids = [...new Set(files.filter((p) => p.endsWith("/status.json")).map((p) => p.split("/")[1]))].sort().reverse();
  const latest = ids[0] ? await readStatus(ids[0]) : null;
  const [[episode], newsIndex] = await Promise.all([listEpisodes(1), readNewsIndex()]);
  const missing = missingEnv();

  return (
    <main className="console">
      <h1>Overview</h1>
      {missing.length > 0 && <p className="panel notice">Missing environment variables: {missing.join(", ")}</p>}

      <div className="cards">
        <section className="card">
          <h2>Start a run</h2>
          <div className="toolbar">
            <form action={startRunAction}>
              <input type="hidden" name="mode" value="fetch-only" />
              <button type="submit">Check feeds (free)</button>
            </form>
            <form action={startRunAction}>
              <input type="hidden" name="mode" value="full" />
              <button type="submit" className="primary">Start full run (~$0.10–0.30)</button>
            </form>
          </div>
        </section>

        <section className="card">
          <h2>Latest run</h2>
          {latest ? (
            <>
              <div className="row">
                <Link href={`/debug/runs/${latest.runId}`} className="mono">{latest.runId}</Link>
                <span className={`pill ${latest.state === "failed" ? "bad" : latest.state === "done" ? "ok" : "warn"}`}>{latest.state}</span>
              </div>
              <div className="steps">
                {STAGES.map((st) => {
                  const v = latest.stages[st]?.state;
                  if (!v || v === "skipped") return null;
                  const cls = v === "failed" ? "bad" : v === "done" || v === "copied" ? "ok" : "warn";
                  return <span key={st} className={`step ${cls}`}>{v === "done" || v === "copied" ? "✓" : v === "failed" ? "✕" : "…"} {st}</span>;
                })}
              </div>
              {latest.stages.rank?.summary?.top ? <p className="muted">Top story: {String(latest.stages.rank.summary.top)}</p> : null}
              <div className="toolbar">
                <Link href={`/debug/runs/${latest.runId}`} className="btnlink">Open run</Link>
                {latest.stages.rank?.state === "done" && <Link href={`/debug/runs/${latest.runId}/review`} className="btnlink">Review ranking</Link>}
              </div>
            </>
          ) : (
            <p className="muted">No runs yet.</p>
          )}
        </section>

        <section className="card">
          <h2>Latest episode</h2>
          {episode ? (
            <>
              <p>{formatDate(episode.date)} · {formatClock(episode.durationSec)} · {episode.chapters.filter((c) => c.kind === "story").length} stories</p>
              <Link href={`/player/${episode.id}`} className="btnlink primary">▶ Play</Link>
            </>
          ) : (
            <p className="muted">No episodes yet. Make audio from a run with a finished script.</p>
          )}
        </section>

        <section className="card">
          <h2>News data</h2>
          {news === "rebuilt" && <p className="ok">Rebuilt from every run.</p>}
          {newsIndex.days.length ? (
            <ul>
              {newsIndex.days.slice(0, 3).map((d) => (
                <li key={d.date}>
                  {formatDate(d.date)}: {d.stories} stories, {d.voiced} with audio{d.hasEpisode ? ", episode" : ""} ·{" "}
                  <Link href={`/debug/runs/${d.runId}`} className="mono">run</Link> · <a href={`/data/news/${d.date}`}>data</a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nothing published yet. Runs publish their day after ranking, analysis, script and audio.</p>
          )}
          <form action={rebuildNewsAction}>
            <button type="submit" title="Rebuild the public pages' data from every saved run (free)">Rebuild from all runs</button>
          </form>
        </section>
      </div>

      <h2>Go to</h2>
      <div className="tiles">
        {TILES.map((t) => (
          <Link key={t.href} href={t.href} className="tile">
            <b>{t.title} →</b>
            <span className="muted">{t.text}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
