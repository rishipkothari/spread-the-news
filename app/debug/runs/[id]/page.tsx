import Link from "next/link";
import { Fragment } from "react";
import { STAGES, type StageId } from "@/pipeline/stages";
import { config } from "@/lib/config";
import { getJson, paths } from "@/lib/storage";
import type { Article, LeanGroup, Source, SourceHealth, Story, StoryBundle, UsageEntry } from "@/lib/types";
import { readStatus } from "@/pipeline/status";
import { analysisAction, replayAction, rerankAction, scriptAction } from "../../actions";

export const dynamic = "force-dynamic";

const STAGE_INFO: Record<StageId, string> = {
  sources: "which outlets and feeds",
  fetch: "read every feed + homepage",
  cluster: "Claude groups articles into stories",
  rank: "score stories (headline index)",
  extract: "full article text",
  analyze: "facts + quotes per article (Haiku)",
  synthesize: "per-story comparison (Sonnet)",
  plan: "pick and order stories, word budgets",
  script: "write + fact-check each story (Sonnet)",
};

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
            <span>C coverage {pct(s.coverage)}</span>
            <span>B balance {pct(s.balance)}</span>
            <span>P prominence {pct(s.prominence)}</span>
            <span>S skew {pct(s.skew)}</span>
            <span>R recency {pct(s.recency)}</span>
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

      <h2>Pipeline</h2>
      <div className="scroll">
        <table>
          <thead><tr><th>Step</th><th>State</th><th>Time</th><th>Result</th><th>Tokens / cost</th><th>Action</th><th>View</th></tr></thead>
          <tbody>
            {STAGES.map((stage) => {
              const st = status.stages[stage];
              const u = (usage ?? []).filter((x) => x.stage === stage);
              const ms = u.reduce((a, x) => a + x.ms, 0);
              const tin = u.reduce((a, x) => a + (x.inputTokens ?? 0), 0);
              const tout = u.reduce((a, x) => a + (x.outputTokens ?? 0), 0);
              const c = u.reduce((a, x) => a + (x.costUsd ?? 0), 0);
              const done = (x?: { state: string }) => x?.state === "done" || x?.state === "copied";
              let action: React.ReactNode = null;
              let view: React.ReactNode = null;
              if (stage === "cluster" && done(status.stages.fetch)) {
                action = (
                  <form action={replayAction}>
                    <input type="hidden" name="runId" value={id} />
                    <input type="hidden" name="from" value="cluster" />
                    <button type="submit" title="Re-group these same articles in a new run (uses Claude)">Re-cluster (new run)</button>
                  </form>
                );
              }
              if (stage === "rank" && done(status.stages.cluster)) {
                action = (
                  <form action={rerankAction}>
                    <input type="hidden" name="runId" value={id} />
                    <button type="submit" title="Re-score with the current weights in config (free)">Re-rank (free)</button>
                  </form>
                );
                if (bundle) view = <Link href={`/debug/runs/${id}/review`}>Review →</Link>;
              }
              if (stage === "extract" && bundle) {
                action = (
                  <form action={analysisAction}>
                    <input type="hidden" name="runId" value={id} />
                    <button type="submit" title="Extract text, facts and synthesis for the top stories (uses Claude)">
                      {done(status.stages.synthesize) ? "Re-run analysis" : "Run analysis"}
                    </button>
                  </form>
                );
              }
              if (stage === "synthesize" && (st?.state ?? "skipped") !== "skipped") view = <Link href={`/debug/runs/${id}/analysis`}>Analysis →</Link>;
              if (stage === "plan" && status.stages.synthesize?.state === "done") {
                action = (
                  <form action={scriptAction}>
                    <input type="hidden" name="runId" value={id} />
                    <button type="submit" title="Plan the episode and write a fact-checked script from the analysis (uses Claude)">
                      {done(status.stages.script) ? "Re-write script" : "Write script"}
                    </button>
                  </form>
                );
              }
              if (stage === "script" && (st?.state ?? "skipped") !== "skipped") view = <Link href={`/debug/runs/${id}/script`}>Script →</Link>;
              const groupHeader = stage === "sources" ? "Discovery" : stage === "extract" ? "Phase 1: analysis (top stories)" : stage === "plan" ? "Phase 2: script" : null;
              return (
                <Fragment key={stage}>
                  {groupHeader && <tr><td colSpan={7} style={{ fontWeight: 600, background: "var(--bg)" }}>{groupHeader}</td></tr>}
                  <tr>
                    <td>{stage}<div className="muted" style={{ fontSize: 12 }}>{STAGE_INFO[stage]}</div></td>
                    <td className={st?.state === "failed" ? "bad" : st?.state === "done" ? "ok" : "muted"}>{st?.state ?? "–"}</td>
                    <td>{ms ? `${(ms / 1000).toFixed(1)}s` : ""}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{st?.error ? <span className="bad">{st.error}</span> : st?.summary ? Object.entries(st.summary).map(([k, v]) => `${k}: ${v}`).join(" · ") : ""}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{tin ? `${tin} in / ${tout} out · $${c.toFixed(4)}` : ""}</td>
                    <td>{action}</td>
                    <td>{view}</td>
                  </tr>
                </Fragment>
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
          <div className="story" style={{ fontSize: 13 }}>
            <b>How stories are scored.</b> index = ({config.ranking.weights.coverage}·C + {config.ranking.weights.balance}·B + {config.ranking.weights.prominence}·P) × (1 − {config.ranking.skewPenalty}·S) × R
            <table style={{ marginTop: 6 }}>
              <tbody>
                <tr><td><b>C</b> coverage</td><td>Share of the outlets that returned data this run that covered the story. An outlet whose only article is opinion counts half.</td></tr>
                <tr><td><b>B</b> balance</td><td>How evenly left, center and right covered it, each side relative to its number of outlets. 0% = one side only, 100% = all three equally.</td></tr>
                <tr><td><b>P</b> prominence</td><td>How prominently the covering outlets played it, averaged: on their homepage (top 10 links {config.ranking.prominence.homepageLead}, top 40 {config.ranking.prominence.homepageFeatured}, anywhere {config.ranking.prominence.homepageListed}), else by feed type (top {config.ranking.prominence.topFeed}, latest {config.ranking.prominence.latestFeed}, section {config.ranking.prominence.sectionFeed}).</td></tr>
                <tr><td><b>S</b> skew</td><td>How one-sided the coverage is, from the average lean of its articles. A penalty: 0% = centered, 100% = all from one extreme.</td></tr>
                <tr><td><b>R</b> recency</td><td>Halves every {config.ranking.recencyHalfLifeHours} hours since the story&apos;s newest article.</td></tr>
                <tr><td><b>outlets</b></td><td>&quot;3 (2.5)&quot; = 3 distinct outlets, 2.5 after counting opinion-only outlets as half. Stories need {config.ranking.minOutlets}+ outlets to be ranked.</td></tr>
              </tbody>
            </table>
            <div className="muted" style={{ marginTop: 4 }}>Click a story for its articles. Bar: left / center / right outlets covering it.</div>
          </div>
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
