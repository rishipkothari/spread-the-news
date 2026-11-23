import Link from "next/link";
import { getJson, paths } from "@/lib/storage";
import type { Article, LeanGroup, Source, StoryBundle, UsageEntry } from "@/lib/types";
import type { AnalysisPlan, AnalyzeOut, ExtractOut, SynthesizeOut } from "@/pipeline/phase1";
import { readStatus } from "@/pipeline/status";
import { buildAnalysisReport } from "@/review/analysis-report";
import { readVersions, versionedPath } from "@/pipeline/versions";
import CopyButton from "../../../CopyButton";
import VersionBar from "../VersionBar";

export const dynamic = "force-dynamic";

const SIDE_COLOR: Record<LeanGroup, string> = { left: "var(--left)", center: "var(--center)", right: "var(--right)" };
const leanColor = (v: number) => (v < 0 ? SIDE_COLOR.left : v > 0 ? SIDE_COLOR.right : SIDE_COLOR.center);
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");

export default async function AnalysisPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  const { id } = await params;
  const versions = await readVersions(id);
  const asked = Number((await searchParams).v) || null;
  // ?v=n views a saved version; the current version (or none given) reads the working files.
  const v = asked && versions.analysis.some((x) => x.n === asked) && asked !== versions.active.analysis ? asked : null;
  const at = (rel: string) => versionedPath(id, rel, "analysis", v, versions);
  const [status, bundle, plan, extract, analyze, synth, allUsage] = await Promise.all([
    readStatus(id),
    getJson<StoryBundle>(paths.bundle(id)),
    getJson<AnalysisPlan>(at("analysis-plan.json")),
    getJson<ExtractOut>(at("extract.json")),
    getJson<AnalyzeOut>(at("analyze.json")),
    getJson<SynthesizeOut>(at("synthesize.json")),
    getJson<UsageEntry[]>(paths.usage(id)),
  ]);
  if (!status || !bundle) return <main><h1>Run {id} has no ranked bundle</h1></main>;
  // Usage is kept for the latest run of each stage only, so costs are shown for the current version.
  const usage = v ? [] : allUsage;

  const running = !v && ["extract", "analyze", "synthesize"].some((s) => ["pending", "running"].includes(status.stages[s as "extract"]?.state ?? ""));
  const sources = new Map<string, Source>(bundle.sources.map((s) => [s.id, s]));
  const articles = new Map<string, Article>(bundle.articles.map((a) => [a.id, a]));
  const factsBy = new Map((analyze?.facts ?? []).map((f) => [f.articleId, f]));
  const report = buildAnalysisReport(bundle, plan, extract, analyze, synth, usage ?? []);
  const stageCost = (s: string) => (usage ?? []).filter((u) => u.stage === s).reduce((a, u) => a + (u.costUsd ?? 0), 0);

  return (
    <main>
      {running && <meta httpEquiv="refresh" content="5" />}
      <div className="sticky">
        <div className="row">
          <Link href={`/debug/runs/${id}`} className="muted">← run</Link>
          <b className="mono">Analysis {id}</b>
          <span className="muted">
            {v ? `version ${v}` : (["extract", "analyze", "synthesize"] as const).map((s) => `${s}: ${status.stages[s]?.state ?? "–"}`).join(" · ")}
            {running ? " · refreshing every 5s" : ""}
          </span>
          <span style={{ flex: 1 }} />
          <CopyButton text={report} />
        </div>
        <VersionBar runId={id} phase="analysis" versions={versions} viewing={v} hrefFor={(n) => `/debug/runs/${id}/analysis?v=${n}`} />
      </div>

      <p className="muted">
        Cost: extract ${stageCost("extract").toFixed(3)} · analyze ${stageCost("analyze").toFixed(3)} · synthesize ${stageCost("synthesize").toFixed(3)}.
        Spot-check a few stories: open an article, and confirm the agreed facts and quotes really say what&apos;s claimed.
      </p>

      {extract && (
        <>
          <h2>Text extraction by source</h2>
          <div className="scroll">
            <table>
              <thead><tr><th>Source</th><th>Attempted</th><th>Full</th><th>Partial</th><th>Headline only</th><th>Success</th><th>Via</th><th>Example problem</th></tr></thead>
              <tbody>
                {Object.entries(extract.report).map(([sid, r]) => (
                  <tr key={sid}>
                    <td><span className="dot" style={{ background: leanColor(sources.get(sid)?.leanValue ?? 0) }} />{sources.get(sid)?.name ?? sid}</td>
                    <td>{r.attempted}</td><td>{r.full}</td><td>{r.partial}</td><td>{r.headline_only}</td>
                    <td className={r.full / r.attempted >= 0.6 ? "ok" : r.full / r.attempted >= 0.3 ? "warn" : "bad"}>{pct(r.full, r.attempted)}</td>
                    <td className="mono">{Object.entries(r.byExtractor).map(([k, v]) => `${k} ${v}`).join(", ")}</td>
                    <td className="mono muted">{r.errors[0] ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {analyze && analyze.errors.length > 0 && (
        <>
          <h2>Fact extraction errors ({analyze.errors.length})</h2>
          <ul className="mono bad">{analyze.errors.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}</ul>
        </>
      )}

      <h2>Stories {synth ? `(${synth.syntheses.length})` : ""}</h2>
      {!synth && <p className="muted">No synthesis yet. Start it with &quot;Run analysis (Phase 1)&quot; on the run page.</p>}
      {(plan?.storyIds ?? []).map((storyId, i) => {
        const s = synth?.syntheses.find((x) => x.storyId === storyId);
        const story = bundle.stories.find((x) => x.id === storyId);
        const chosen = plan?.articleIds[storyId] ?? [];
        return (
          <div className="story" key={storyId}>
            <div className="row">
              <span className="rank">{i + 1}</span>
              <span className="title">{s?.title ?? story?.title}</span>
              <span className="pill">{story?.category}</span>
            </div>
            {s ? (
              <>
                <p style={{ margin: "8px 0" }}>{s.summary}</p>
                {s.recently && <p className="muted" style={{ margin: "4px 0" }}><b>Recently:</b> {s.recently}</p>}
                {s.agreedFacts.length > 0 && (
                  <>
                    <h3 style={{ fontSize: 13, margin: "10px 0 4px" }}>Agreed facts</h3>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {s.agreedFacts.map((f, j) => (
                        <li key={j}>
                          {f.fact}{" "}
                          <details style={{ display: "inline" }}>
                            <summary className="muted" style={{ display: "inline", cursor: "pointer" }}>
                              [{[...new Set(f.support.map((x) => sources.get(articles.get(x.articleId)?.sourceId ?? "")?.name))].join(", ")}]
                            </summary>
                            <ul className="muted" style={{ fontSize: 12 }}>
                              {f.support.map((x, k) => <li key={k}>{sources.get(articles.get(x.articleId)?.sourceId ?? "")?.name}: “{x.quote}”</li>)}
                            </ul>
                          </details>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {(s.singleSourceFacts?.length ?? 0) > 0 && (
                  <>
                    <h3 style={{ fontSize: 13, margin: "10px 0 4px" }}>Reported by one outlet only</h3>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {s.singleSourceFacts!.map((f, j) => (
                        <li key={j}>
                          <span className="muted">{sources.get(f.sourceId)?.name}:</span> {f.fact}
                          <div className="muted" style={{ fontSize: 12 }}>“{f.support[0]?.quote}”</div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {s.disputed.length > 0 && (
                  <>
                    <h3 style={{ fontSize: 13, margin: "10px 0 4px" }}>Disputed</h3>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {s.disputed.map((d, j) => (
                        <li key={j}>
                          <span className="pill" title={d.significance === "minor" ? "Small mismatch: left out of the script" : "Changes the story: the script presents each side"}>{d.significance ?? "material"}</span>{" "}
                          {d.claim}
                          <ul style={{ fontSize: 13 }}>
                            {d.positions.map((p, k) => (
                              <li key={k}>
                                {p.position} <span className="muted">[{p.sourceIds.map((sid) => sources.get(sid)?.name ?? sid).join(", ")}]</span>
                                {p.quote && <div className="muted" style={{ fontSize: 12 }}>“{p.quote}”</div>}
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {Object.keys(s.framing).length > 0 && (
                  <>
                    <h3 style={{ fontSize: 13, margin: "10px 0 4px" }}>Framing by side</h3>
                    {(["left", "center", "right"] as LeanGroup[]).map((side) =>
                      s.framing[side] ? (
                        <div key={side} style={{ borderLeft: `3px solid ${SIDE_COLOR[side]}`, paddingLeft: 8, margin: "4px 0", fontSize: 13 }}>
                          <b>{side}:</b> {s.framing[side]}
                        </div>
                      ) : null,
                    )}
                  </>
                )}
              </>
            ) : (
              <p className="muted">
                {synth?.skipped?.includes(storyId)
                  ? "Headlines only: none of this story's articles had readable text, so it wasn't synthesized."
                  : synth?.errors.find((e) => e.startsWith(storyId)) ?? "not synthesized yet"}
              </p>
            )}
            <details style={{ marginTop: 8 }}>
              <summary className="muted" style={{ cursor: "pointer" }}>Articles and extracted facts ({chosen.length})</summary>
              <ul className="arts">
                {chosen.map((aid) => {
                  const a = articles.get(aid);
                  const t = extract?.texts[aid];
                  const f = factsBy.get(aid);
                  if (!a) return null;
                  return (
                    <li key={aid}>
                      <span className="dot" style={{ background: leanColor(sources.get(a.sourceId)?.leanValue ?? 0) }} />
                      <b>{sources.get(a.sourceId)?.name}</b>{" "}
                      <span className="muted">[{a.articleType ?? "?"} · {t ? `${t.textStatus}, ${t.chars} chars via ${t.extractor}` : "not extracted"}{f?.skipped ? ` · skipped: ${f.skipped}` : f ? ` · ${f.facts.length} facts` : ""}]</span>{" "}
                      <a href={a.url} target="_blank" rel="noreferrer">{a.title}</a>
                      {t?.error && t.textStatus !== "full" && <div className="muted mono" style={{ fontSize: 11 }}>{t.error}</div>}
                      {f && f.facts.length > 0 && (
                        <ul style={{ fontSize: 12, margin: "4px 0 0" }}>
                          {f.facts.map((x, k) => (
                            <li key={k}>
                              <span className="muted">({x.kind}{x.speaker ? `, ${x.speaker}` : ""})</span> {x.claim}
                              <div className="muted">“{x.quote}”</div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </details>
          </div>
        );
      })}

      <h2>Report preview</h2>
      <details>
        <summary className="muted" style={{ cursor: "pointer" }}>Show the text that gets copied</summary>
        <textarea readOnly value={report} rows={20} style={{ width: "100%", fontFamily: "ui-monospace, monospace", fontSize: 12 }} />
      </details>
    </main>
  );
}
