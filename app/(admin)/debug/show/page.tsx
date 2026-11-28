import Link from "next/link";
import { config } from "@/lib/config";
import { getJson, listRunIds, paths } from "@/lib/storage";
import type { EpisodePlan, EpisodeScript, TemplateKind } from "@/lib/types";
import { defaultShowText, loadShowText } from "@/show/store";
import { templateText } from "@/stages/script/templates";
import { hearLineAction, resetShowTextAction, saveShowTextAction, useOnRunAction } from "./actions";

export const dynamic = "force-dynamic";

const LINES: { kind: TemplateKind; label: string; help: string }[] = [
  { kind: "welcome", label: "Welcome", help: "Opens every episode." },
  { kind: "rundown", label: "Today's rundown", help: "Plays after the welcome. {stories} becomes the top story titles. Leave empty to skip it." },
  { kind: "outro", label: "Sign-off", help: "Closes every episode." },
];

/** The latest runs that have a script, newest first. */
async function scriptedRuns(): Promise<{ runId: string; script: EpisodeScript }[]> {
  const out: { runId: string; script: EpisodeScript }[] = [];
  for (const runId of (await listRunIds()).slice(0, 20)) {
    const script = await getJson<EpisodeScript>(paths.stage(runId, "script")).catch(() => null);
    if (script?.segments.some((s) => s.kind === "story")) out.push({ runId, script });
    if (out.length >= 6) break;
  }
  return out;
}

export default async function ShowPage({ searchParams }: { searchParams: Promise<{ msg?: string; play?: string }> }) {
  const sp = await searchParams;
  const [show, runs] = await Promise.all([loadShowText(), scriptedRuns()]);
  const defaults = defaultShowText();
  const plan = runs[0] ? await getJson<EpisodePlan>(paths.stage(runs[0].runId, "plan")).catch(() => null) : null;
  const latestTitles = plan?.stories.map((p) => p.title) ?? [];
  const sampleTitles = latestTitles.length ? latestTitles : ["Story one", "Story two", "Story three"];

  return (
    <main>
      <h1>Intro and sign-off</h1>
      <p className="muted">
        The fixed lines read at the start and end of every episode, in the episode voice ({config.audio.voice}). Write the name as &quot;Prism&quot;, not &quot;PRISM&quot;: the voice spells out words in capitals.{" "}
        {show.origin === "blob" && show.updatedAt ? <>Last saved {new Date(show.updatedAt).toLocaleString()}.</> : <>Using the default lines.</>}
      </p>
      {sp.msg && <p className="story" style={{ borderLeft: "4px solid var(--accent, currentColor)" }}>{sp.msg}</p>}
      {sp.play && (
        <div className="story">
          <b>Listen</b>
          <audio controls autoPlay preload="auto" src={`/audio/${sp.play}`} style={{ width: "100%", marginTop: 8 }} />
        </div>
      )}

      <form action={saveShowTextAction} className="story">
        {LINES.map(({ kind, label, help }) => (
          <div className="field" key={kind}>
            <label htmlFor={kind}>{label} <span className="muted">· {help}</span></label>
            <textarea id={kind} name={kind} rows={3} defaultValue={show[kind]} />
            {show[kind] !== defaults[kind] && <div className="muted" style={{ fontSize: 12 }}>Default: {defaults[kind] || "(empty)"}</div>}
          </div>
        ))}
        <p><button type="submit" className="primary">Save</button> <span className="muted">Used by every script written after you save.</span></p>
      </form>

      <h2>Hear it</h2>
      <p className="muted">Voices the saved line as the episode will (the rundown with today&apos;s top stories filled in). Takes a few seconds.</p>
      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
        {LINES.filter(({ kind }) => show[kind].trim()).map(({ kind, label }) => (
          <form action={hearLineAction} key={kind}>
            <input type="hidden" name="text" value={templateText(kind, sampleTitles, show)} />
            <button type="submit">▶ {label}</button>
          </form>
        ))}
      </div>

      <h2>Use on an existing episode</h2>
      <p className="muted">
        Puts the saved lines into a run&apos;s script without rewriting any story (free). Then open the run and press &quot;Re-make audio&quot;.
      </p>
      {runs.length ? (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {runs.map(({ runId, script }) => {
            const has = (kind: TemplateKind) => (script.segments.find((s) => s.kind === kind)?.text ?? "") === show[kind].trim();
            const same = has("welcome") && has("outro");
            return (
              <li key={runId} className="row" style={{ gap: 8, margin: "6px 0" }}>
                <form action={useOnRunAction}>
                  <input type="hidden" name="runId" value={runId} />
                  <button type="submit">Use on this run</button>
                </form>
                <Link href={`/debug/runs/${runId}`} className="mono">{runId}</Link>
                <span className="muted">{same ? "already has the welcome and sign-off" : ""}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted">No run has a script yet.</p>
      )}

      {show.origin === "blob" && (
        <form action={resetShowTextAction} style={{ marginTop: 24 }}>
          <button type="submit">Reset to the default lines</button>
        </form>
      )}
    </main>
  );
}
