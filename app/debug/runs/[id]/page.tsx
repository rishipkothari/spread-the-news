import Link from "next/link";
import { config } from "@/lib/config";
import { getJson, paths } from "@/lib/storage";
import type { Article, LeanGroup, Source, SourceHealth, Story, StoryBundle, UsageEntry } from "@/lib/types";
import { readStatus } from "@/pipeline/status";
import { replayAction, rerankAction } from "../../actions";

export const dynamic = "force-dynamic";

const GROUP_COLOR: Record<LeanGroup, string> = { left: "var(--left)", center: "var(--center)", right: "var(--right)" };
const leanColor = (v: number) => (v < 0 ? GROUP_COLOR.left : v > 0 ? GROUP_COLOR.right : GROUP_COLOR.center);
const pct = (n: number | undefined) => (n == null ? "–" : `${Math.round(n * 100)}%`);

function LeanBar({ mix }: { mix: Record<LeanGroup, number> }) {
  const total = mix.left + mix.center + mix.right || 1;
  return (
    <span className="bar" title={`left ${mix.left} · center ${mix.center} · right ${mix.right}`}>
      {(["left", "center", "right"] as LeanGroup[]).map((g) => (
        <span key={g} style={{ width: `${(mix[g] / total) * 100}%`, background: GROUP_COLOR[g] }} />
      ))}
    </span>
  );
}

function StoryCard({ story, rank, articles, sources }: { story: Story; rank?: number; articles: Map<string, Article>; sources: Map<string, Source> }) {
  const s = story.signals;
  const arts = story.articleIds.map((id) => articles.get(id)).filter((a): a is Article => !!a);
  return (
    <details className="story">
      <summary>
        <div className="row">
          <span className="rank">{rank ?? "·"}</span>
          <span className="title">{story.title}</span>
          <span className="pill">{story.category}{story.secondaryCategory ? ` / ${story.secondaryCategory}` : ""}</span>
          {s && <LeanBar mix={s.leanMix} />}
          <span className="mono">{story.headlineIndex.toFixed(3)}</span>
        </div>
        {s && (
          <div className="signals">
            <span>outlets {s.distinctOutlets} ({s.outletCount})</span>
            <span>C {pct(s.coverage)}</span>
            <span>B {pct(s.balance)}</span>
            <span>P {pct(s.prominence)}</span>
            <span>S {pct(s.skew)}</span>
            <span>R {pct(s.recency)}</span>
            <span>articles {arts.length}</span>
            {story.continuesStoryId && <span>continues {story.continuesStoryId}</span>}
          </div>
        )}
      </summary>
      <ul className="arts">
        {arts.map((a) => {
          const src = sources.get(a.sourceId);
          return (
            <li key={a.id}>
              <span className="dot" style={{ background: leanColor(src?.leanValue ?? 0) }} />
              <b>{src?.name ?? a.sourceId}</b> <span className="muted">[{a.articleType ?? "?"}, {a.prominence}{a.homepageRank ? `, homepage #${a.homepageRank}` : ""}]</span>{" "}
              <a href={a.url} target="_blank" rel="noreferrer">{a.title}</a>{" "}
              <span className="muted mono">{a.publishedAt.slice(5, 16).replace("T", " ")}</span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function HealthTable({ health, sources }: { health: SourceHealth; sources: Source[] }) {
  return (
    <div className="scroll">
      <table>
        <thead><tr><th>Source</th><th>Lean</th><th>Status</th><th>In window</th><th>Parsed</th><th>Homepage</th><th>Feeds / errors</th></tr></thead>
        <tbody>
          {sources.map((src) => {
            const h = health[src.id];
            return (
              <tr key={src.id}>
                <td><span className="dot" style={{ background: leanColor(src.leanValue) }} />{src.name}</td>
                <td>{src.lean}{src.leanProvenance.verified ? "" : <span className="muted"> (unverified)</span>}</td>
                <td className={h?.ok ? "ok" : "bad"}>{h ? (h.ok ? "ok" : "failed") : "–"}</td>
                <td>{h?.inWindow ?? "–"}</td>
                <td>{h?.items ?? "–"}</td>
                <td className={h?.homepage ? (h.homepage.ok ? "" : "bad") : "muted"}>
                  {h?.homepage ? (h.homepage.ok ? `${h.homepage.matched} of ours / ${h.homepage.articleLinks} links` : h.homepage.error) : "–"}
                </td>
                <td className="mono">
                  {h?.error && <div className="bad">{h.error}</div>}
                  {h?.feeds?.map((f) => <div key={f.url} className={f.ok ? "muted" : "bad"}>{f.ok ? "✓" : "✗"} {f.url} ({f.items}){f.error ? ` – ${f.error}` : ""}</div>)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const status = await readStatus(id);
  if (!status) return <main><h1>Run {id} not found</h1></main>;

  const [bundle, usage, fetched, clustered] = await Promise.all([
    getJson<StoryBundle>(paths.bundle(id)),
    getJson<UsageEntry[]>(paths.usage(id)),
    getJson<{ articles: Article[]; sourceHealth: SourceHealth; window: { start: string; end: string } }>(paths.stage(id, "fetch")),
    getJson<{ warnings: string[] }>(paths.stage(id, "cluster")),
  ]);
  const sourcesOut = bundle ? { sources: bundle.sources } : await getJson<{ sources: Source[] }>(paths.stage(id, "sources"));
  const sources = sourcesOut?.sources ?? [];
  const health = bundle?.sourceHealth ?? fetched?.sourceHealth;
  const articles = new Map((bundle?.articles ?? fetched?.articles ?? []).map((a) => [a.id, a]));
  const sourceMap = new Map(sources.map((s) => [s.id, s]));
  const ranked = bundle?.stories.filter((s) => s.ranked) ?? [];
  const unranked = bundle?.stories.filter((s) => !s.ranked) ?? [];
  const cost = (usage ?? []).reduce((a, u) => a + (u.costUsd ?? 0), 0);
  const window = bundle?.window ?? fetched?.window;

  return (
    <main>
      {(status.state === "queued" || status.state === "running") && <meta httpEquiv="refresh" content="5" />}
      <p className="muted"><Link href="/debug/runs">← runs</Link>{status.state === "queued" || status.state === "running" ? " · refreshing every 5s" : ""}</p>
      <h1 className="mono" style={{ fontSize: 18 }}>{id}</h1>
      <div className="row muted">
        <span className={status.state === "failed" ? "bad" : status.state === "done" ? "ok" : "warn"}>{status.state}</span>
        {window && <span>window {window.start.slice(0, 16)} → {window.end.slice(0, 16)} UTC</span>}
        <span>cost ${cost.toFixed(4)}</span>
        {status.replayFrom && <span>replay of <Link href={`/debug/runs/${status.replayFrom}`}>{status.replayFrom}</Link></span>}
        <span className="mono">{Object.entries(status.methods).map(([k, v]) => `${k}=${v}`).join(" ")}</span>
      </div>

      <div className="row" style={{ margin: "12px 0" }}>
        {bundle && <Link href={`/debug/runs/${id}/review`} className="big" style={{ margin: 0, padding: "6px 12px" }}>Review this run →</Link>}
        {(status.stages.fetch?.state === "done" || status.stages.fetch?.state === "copied") && (
          <form action={replayAction}>
            <input type="hidden" name="runId" value={id} />
            <input type="hidden" name="from" value="cluster" />
            <button type="submit">Re-cluster these articles (new run)</button>
          </form>
        )}
        {status.stages.cluster?.state === "done" && (
          <form action={rerankAction}>
            <input type="hidden" name="runId" value={id} />
            <button type="submit">Re-rank (free)</button>
          </form>
        )}
      </div>

      <h2>Stages</h2>
      <div className="scroll">
        <table>
          <thead><tr><th>Stage</th><th>State</th><th>Time</th><th>Summary</th><th>Tokens / cost</th></tr></thead>
          <tbody>
            {Object.entries(status.stages).map(([stage, st]) => {
              const u = (usage ?? []).filter((x) => x.stage === stage);
              const ms = u.reduce((a, x) => a + x.ms, 0);
              const tin = u.reduce((a, x) => a + (x.inputTokens ?? 0), 0);
              const tout = u.reduce((a, x) => a + (x.outputTokens ?? 0), 0);
              const c = u.reduce((a, x) => a + (x.costUsd ?? 0), 0);
              return (
                <tr key={stage}>
                  <td>{stage}</td>
                  <td className={st?.state === "failed" ? "bad" : st?.state === "done" ? "ok" : "muted"}>{st?.state}</td>
                  <td>{ms ? `${(ms / 1000).toFixed(1)}s` : ""}</td>
                  <td className="mono">{st?.error ? <span className="bad">{st.error}</span> : st?.summary ? JSON.stringify(st.summary) : ""}</td>
                  <td className="mono">{tin ? `${tin} in / ${tout} out · $${c.toFixed(4)}` : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {status.errors.length > 0 && <ul className="bad">{status.errors.map((e) => <li key={e}>{e}</li>)}</ul>}

      {health && (<><h2>Source health</h2><HealthTable health={health} sources={sources} /></>)}

      {bundle && (
        <>
          <h2>Ranked stories ({ranked.length})</h2>
          <p className="muted">
            index = ({config.ranking.weights.coverage}·C + {config.ranking.weights.balance}·B + {config.ranking.weights.prominence}·P) × (1 − {config.ranking.skewPenalty}·S) × R.
            P = mean over covering outlets of their best signal (homepage lead/featured/listed, then top / latest / section feed). Click a story for its articles. Bars: left / center / right outlets.
          </p>
          {ranked.map((s, i) => <StoryCard key={s.id} story={s} rank={i + 1} articles={articles} sources={sourceMap} />)}
          <h2>Below the {config.ranking.minOutlets}-outlet minimum ({unranked.length})</h2>
          {unranked.map((s) => <StoryCard key={s.id} story={s} articles={articles} sources={sourceMap} />)}
        </>
      )}
      {clustered?.warnings?.length ? (
        <>
          <h2>Clusterer warnings ({clustered.warnings.length})</h2>
          <ul className="mono muted">{clustered.warnings.slice(0, 50).map((w, i) => <li key={i}>{w}</li>)}</ul>
        </>
      ) : null}
    </main>
  );
}
