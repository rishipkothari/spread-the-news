import Link from "next/link";
import { PHASES, type Phase, type VersionInfo, type Versions } from "@/pipeline/versions";
import { activateVersionAction } from "../../actions";

const NAME: Record<Phase, string> = { analysis: "Analysis", script: "Script", audio: "Audio" };
const when = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** One line per version: what it made and what it was built from. */
export function versionLabel(phase: Phase, v: VersionInfo): string {
  const sum = (stage: string) => v.stages[stage as keyof VersionInfo["stages"]]?.summary ?? {};
  const based = PHASES.filter((p) => v.basedOn[p]).map((p) => `${p} v${v.basedOn[p]}`).join(", ");
  const what =
    phase === "analysis" ? `${sum("synthesize").syntheses ?? "?"} syntheses`
    : phase === "script" ? `${sum("script").stories ?? sum("plan").stories ?? "?"} stories${sum("script").dropped ? `, ${sum("script").dropped} dropped` : ""}${sum("script").minutes ? `, ${sum("script").minutes} min` : ""}`
    : `${sum("assemble").minutes ?? "?"} min`;
  return `${when(v.createdAt)} · ${what}${based ? ` · from ${based}` : ""}${v.legacy ? " · saved from before versions" : ""}`;
}

export function UseVersionButton({ runId, phase, n, back, label = "Use this version" }: { runId: string; phase: Phase; n: number; back: string; label?: string }) {
  return (
    <form action={activateVersionAction} style={{ display: "inline" }}>
      <input type="hidden" name="runId" value={runId} />
      <input type="hidden" name="phase" value={phase} />
      <input type="hidden" name="n" value={n} />
      <input type="hidden" name="back" value={back} />
      <button type="submit" title={`Make ${phase} v${n} the current one: the run page, later phases and their buttons use it`}>{label}</button>
    </form>
  );
}

/** On the analysis and script pages: pick a version to view; the viewed one can be made current. */
export default function VersionBar({ runId, phase, versions, viewing, hrefFor }: { runId: string; phase: Phase; versions: Versions; viewing: number | null; hrefFor: (n: number) => string }) {
  const list = versions[phase];
  if (!list.length) return null;
  const active = versions.active[phase];
  const shown = viewing ?? active;
  return (
    <div className="row" style={{ gap: 8, fontSize: 13, margin: "6px 0" }}>
      <span className="muted">{NAME[phase]} versions:</span>
      {list.map((v) => (
        <Link key={v.n} href={hrefFor(v.n)} title={versionLabel(phase, v)} style={v.n === shown ? { fontWeight: 700, textDecoration: "underline" } : {}}>
          v{v.n}{v.n === active ? " (current)" : ""}
        </Link>
      ))}
      {shown != null && shown !== active && (
        <>
          <span className="warn">Viewing v{shown}, not the current version.</span>
          <UseVersionButton runId={runId} phase={phase} n={shown} back={hrefFor(shown)} />
        </>
      )}
    </div>
  );
}
