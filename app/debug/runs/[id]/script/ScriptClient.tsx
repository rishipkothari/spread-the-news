"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CheckResult, EpisodePlan, EpisodeScript, Segment, UsageEntry } from "@/lib/types";
import type { ScriptUnit } from "@/pipeline/phase2";
import { buildScriptReport } from "@/review/script-report";
import type { ScriptReview, SegmentFeedback } from "@/review/script-types";
import CopyButton from "../../../CopyButton";
import { saveScriptReview } from "../../../review-actions";

function CheckDetails({ check, label }: { check: CheckResult; label: string }) {
  const mustFix = check.issues.filter((i) => i.severity === "must_fix").length;
  return (
    <details style={{ marginTop: 6 }}>
      <summary className="muted" style={{ cursor: "pointer", fontSize: 13 }}>
        {label}: <span className={check.pass ? "ok" : "bad"}>{check.pass ? "passed" : "failed"}</span> · {check.claims.length} claims · {mustFix} must-fix · {check.issues.length - mustFix} minor
      </summary>
      {check.issues.length > 0 && (
        <ul style={{ fontSize: 13, margin: "4px 0" }}>
          {check.issues.map((i, k) => (
            <li key={k} className={i.severity === "must_fix" ? "bad" : "muted"}>
              [{i.kind}{i.source === "code" ? ", code check" : ""}] “{i.excerpt}”: {i.problem}{i.fix ? <span className="muted"> Fix: {i.fix}</span> : null}
            </li>
          ))}
        </ul>
      )}
      <table style={{ fontSize: 12, marginTop: 4 }}>
        <thead><tr><th>Claim</th><th>Support</th><th>Status</th></tr></thead>
        <tbody>
          {check.claims.map((c, k) => (
            <tr key={k}>
              <td>{c.claim}</td>
              <td className="mono">{c.support.join(", ") || "–"}</td>
              <td className={c.status === "supported" ? "ok" : "bad"}>{c.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

function Feedback({ value, onChange }: { value: SegmentFeedback | undefined; onChange: (f: SegmentFeedback) => void }) {
  const v = value ?? {};
  const vote = (x: "up" | "down") => onChange({ ...v, vote: v.vote === x ? undefined : x });
  return (
    <div className="row" style={{ marginTop: 8, gap: 6 }}>
      <button type="button" onClick={() => vote("up")} style={v.vote === "up" ? { borderColor: "var(--ok)", fontWeight: 700 } : {}} aria-pressed={v.vote === "up"}>👍</button>
      <button type="button" onClick={() => vote("down")} style={v.vote === "down" ? { borderColor: "var(--bad)", fontWeight: 700 } : {}} aria-pressed={v.vote === "down"}>👎</button>
      <input
        type="text"
        placeholder="Note (tone, accuracy, too long…)"
        value={v.note ?? ""}
        onChange={(e) => onChange({ ...v, note: e.target.value })}
        style={{ flex: 1, minWidth: 180 }}
      />
    </div>
  );
}

export default function ScriptClient(props: {
  runId: string;
  plan: EpisodePlan;
  script: EpisodeScript | null;
  units: ScriptUnit[];
  usage: UsageEntry[];
  initial: ScriptReview;
  running: boolean;
  stageStates: string;
}) {
  const { runId, plan, script, units, usage, running } = props;
  const [review, setReview] = useState<ScriptReview>(props.initial);
  const [saveState, setSaveState] = useState(props.initial.savedAt ? `saved ${new Date(props.initial.savedAt).toLocaleTimeString()}` : "");
  const dirty = useRef(false);

  // Autosave 1.5s after the last change.
  useEffect(() => {
    if (!dirty.current) return;
    setSaveState("unsaved changes…");
    const t = setTimeout(async () => {
      const res = await saveScriptReview(review);
      setSaveState(res.ok ? `saved ${new Date(res.savedAt).toLocaleTimeString()}` : `save failed: ${res.error}`);
    }, 1500);
    return () => clearTimeout(t);
  }, [review]);

  const update = (fn: (r: ScriptReview) => ScriptReview) => {
    dirty.current = true;
    setReview((r) => fn(r));
  };
  const setSeg = (id: string, f: SegmentFeedback) => update((r) => ({ ...r, segments: { ...r.segments, [id]: f } }));

  const report = useMemo(() => buildScriptReport(runId, plan, script, units, usage, review), [runId, plan, script, units, usage, review]);
  const fullText = (script?.segments ?? []).map((s) => s.text).join("\n\n");
  const byId = new Map(units.map((u) => [u.storyId, u]));
  const cost = usage.filter((u) => u.stage === "script").reduce((a, u) => a + (u.costUsd ?? 0), 0);
  let storyNo = 0;

  const renderSegment = (seg: Segment) => {
    const unit = seg.storyId ? byId.get(seg.storyId) : undefined;
    const p = plan.stories.find((s) => s.storyId === seg.storyId);
    const heading = seg.kind === "story" ? `${++storyNo}. ${unit?.title ?? seg.storyId}` : seg.kind === "intro" ? "Intro" : "Outro";
    return (
      <div className="story" key={seg.id}>
        <div className="row">
          <span className="title">{heading}</span>
          {p && <span className="pill">{p.category}</span>}
          <span className="muted" style={{ fontSize: 13 }}>
            {seg.kind === "story" ? `rank ${p?.rank} · ${seg.words} / ${p?.wordBudget} words` : "fixed template"}
            {unit && unit.attempts.length > 1 ? " · rewritten once" : ""}
          </span>
        </div>
        <div style={{ whiteSpace: "pre-wrap", margin: "8px 0", lineHeight: 1.55, fontSize: 16 }}>{seg.text}</div>
        {"claims" in seg.checkerResult && <CheckDetails check={seg.checkerResult} label="Checker" />}
        {unit && unit.attempts.length > 1 && (
          <details style={{ marginTop: 4 }}>
            <summary className="muted" style={{ cursor: "pointer", fontSize: 13 }}>First draft (failed the check)</summary>
            <div style={{ whiteSpace: "pre-wrap", fontSize: 14, margin: "6px 0" }} className="muted">{unit.attempts[0].text}</div>
            <CheckDetails check={unit.attempts[0].check} label="First check" />
          </details>
        )}
        <Feedback value={review.segments[seg.id]} onChange={(f) => setSeg(seg.id, f)} />
      </div>
    );
  };

  return (
    <main>
      {running && <meta httpEquiv="refresh" content="5" />}
      <div className="sticky">
        <div className="row">
          <Link href={`/debug/runs/${runId}`} className="muted">← run</Link>
          <b className="mono">Script {runId}</b>
          <span className="muted">{props.stageStates}{running ? " · refreshing every 5s" : ""}{saveState ? ` · ${saveState}` : ""}</span>
          <span style={{ flex: 1 }} />
          {fullText && <CopyButton text={fullText} label="Copy script text" />}
          <CopyButton text={report} />
        </div>
      </div>

      <p className="muted">
        {script
          ? <>{script.segments.filter((s) => s.kind === "story").length} stories · {script.words} words ≈ {script.estMinutes} min · {script.dropped.length} dropped · cost ${cost.toFixed(3)}. </>
          : <>Writing {plan.stories.length} stories… </>}
        Read it as a listener would. Mark each segment 👍 or 👎 and add a note on anything off (tone, accuracy, length), then copy the report to Claude.
      </p>
      {script?.policy.reasons.map((r) => <p key={r} className="warn" style={{ margin: "2px 0" }}>{r}</p>)}
      {script?.errors.map((e) => <p key={e} className="bad">{e}</p>)}

      {script ? (
        script.segments.map(renderSegment)
      ) : (
        <ul className="muted">
          {plan.stories.map((s) => <li key={s.storyId}>{s.title} {byId.get(s.storyId) ? (byId.get(s.storyId)!.segment ? "✓ written" : "✗ dropped") : "…"}</li>)}
        </ul>
      )}

      <div className="field" style={{ marginTop: 16 }}>
        <b>Overall notes</b>
        <textarea rows={4} value={review.notes} onChange={(e) => update((r) => ({ ...r, notes: e.target.value }))} placeholder="How did it sound overall? Tone, pacing, anything missing…" />
      </div>

      {script && script.dropped.length > 0 && (
        <>
          <h2>Dropped by the checker ({script.dropped.length})</h2>
          {script.dropped.map((d) => {
            const unit = byId.get(d.storyId);
            return (
              <div className="story" key={d.storyId}>
                <div className="title">{d.title}</div>
                <p className="bad" style={{ margin: "4px 0", fontSize: 13 }}>{d.reason}</p>
                {unit?.attempts.map((a, k) => (
                  <details key={k}>
                    <summary className="muted" style={{ cursor: "pointer", fontSize: 13 }}>Draft {k + 1} ({a.words} words)</summary>
                    <div style={{ whiteSpace: "pre-wrap", fontSize: 14, margin: "6px 0" }}>{a.text}</div>
                    <CheckDetails check={a.check} label={`Check ${k + 1}`} />
                  </details>
                ))}
              </div>
            );
          })}
        </>
      )}

      <h2>Plan</h2>
      <p className="muted" style={{ fontSize: 13 }}>
        Order: {plan.orderStrategy} · categories: {plan.params.categories === "all" ? "all" : JSON.stringify(plan.params.categories)} · target {Math.round(plan.params.targetDurationSec / 60)} min ({plan.targetWords} words at {plan.wordsPerMinute}/min) · planned {plan.plannedWords} words
      </p>
      <ol style={{ fontSize: 13 }}>
        {plan.stories.map((s) => <li key={s.storyId}>{s.title} <span className="muted">(rank {s.rank}, {s.category}, {s.wordBudget} words{s.lead ? ", lead" : ""})</span></li>)}
      </ol>
      {plan.skipped.length > 0 && (
        <details>
          <summary className="muted" style={{ cursor: "pointer" }}>Not planned ({plan.skipped.length})</summary>
          <ul className="muted" style={{ fontSize: 13 }}>{plan.skipped.map((s) => <li key={s.storyId}>{s.title}: {s.reason}</li>)}</ul>
        </details>
      )}

      <h2>Report preview</h2>
      <details>
        <summary className="muted" style={{ cursor: "pointer" }}>Show the text that gets copied</summary>
        <textarea readOnly value={report} rows={20} style={{ width: "100%", fontFamily: "ui-monospace, monospace", fontSize: 12 }} />
      </details>
    </main>
  );
}
