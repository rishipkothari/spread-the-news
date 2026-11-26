import Link from "next/link";
import { formatClock, formatDate, listEpisodes } from "@/audio/episodes";
import { missingEnv } from "@/lib/env";
import { listRunIds } from "@/lib/storage";
import { STAGES } from "@/pipeline/stages";
import { readStatus } from "@/pipeline/status";
import { readNewsIndex } from "@/news/store";
import { feedbackConfigured } from "@/feedback/github";
import SendToClaude from "../../_feedback/SendToClaude";
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
  // Each part loads on its own: one failing (storage hiccup, odd file) shows its error in its card instead of breaking the page.
  const problems: string[] = [];
  const safe = async <T,>(what: string, f: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await f();
    } catch (e) {
      problems.push(`${what}: ${e instanceof Error ? e.message : String(e)}`);
      return fallback;
    }
  };
  const [latest, [episode], newsIndex] = await Promise.all([
    safe("Latest run", async () => {
      // The newest folder may be a run that's still being created; take the newest with a status.
      for (const id of (await listRunIds()).slice(0, 5)) {
        const s = await readStatus(id);
        if (s) return s;
      }
      return null;
    }, null),
    safe("Latest episode", () => listEpisodes(1), []),
    safe("News data", () => readNewsIndex(), { days: [] } as Awaited<ReturnType<typeof readNewsIndex>>),
  ]);
  const missing = missingEnv();
  const feedbackOn = feedbackConfigured();

  return (
    <main className="console">
      <h1>Overview</h1>
      {missing.length > 0 && <p className="panel notice">Missing environment variables: {missing.join(", ")}</p>}
      {problems.map((p) => <p key={p} className="panel notice bad">Couldn&apos;t load {p}</p>)}

      <div className="cards">
        <section className="card">
          <h2>Start a run</h2>
          <div className="toolbar">
            <form action={startRunAction}>
              <input type="hidden" name="mode" value="fetch-only" />
              <button type="submit">Check feeds (free)</button>
            </form>
            <form action={startRunAction}>
              <input type="hidden" name="mode" value="create" />
              <button type="submit" title="Make a new run without starting it. Its page lets you find stories or run everything.">Create run</button>
            </form>
            <form action={startRunAction}>
              <input type="hidden" name="mode" value="everything" />
              <button type="submit" className="primary" title="Find stories, analyze, write the script and make the audio in one go (uses Claude)">Run full pipeline (~$0.60–1.00)</button>
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

        <section className="card">
          <h2>Note to Claude</h2>
          {feedbackOn ? (
            <p className="muted">Anything at all: an idea, a bug, something you heard. Claude reads it at the start of the next session.</p>
          ) : (
            <p className="warn">Sending needs GITHUB_FEEDBACK_TOKEN in Vercel&apos;s environment variables.</p>
          )}
          <SendToClaude area="general" title="Note from the admin console" inline placeholder="What should Claude know?" />
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
