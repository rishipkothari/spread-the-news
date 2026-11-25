import Link from "next/link";
import { getJson, paths } from "@/lib/storage";
import type { AssembleOut } from "@/pipeline/phase3";
import { readStatus } from "@/pipeline/status";
import { readVersions } from "@/pipeline/versions";

export type RunTab = "run" | "review" | "analysis" | "script";

/**
 * Navigation shared by a run's pages: a clear way back to the run, and tabs to jump straight between
 * ranking review, analysis, script and the episode. Tabs for steps that haven't run are greyed out.
 */
export default async function RunNav({ runId, current }: { runId: string; current: RunTab }) {
  const [status, versions, assembled] = await Promise.all([
    readStatus(runId),
    readVersions(runId),
    getJson<AssembleOut>(paths.stage(runId, "assemble")),
  ]);
  const state = (s: string) => status?.stages[s as keyof NonNullable<typeof status>["stages"]]?.state;
  const ran = (s: string) => !!state(s) && state(s) !== "skipped";
  const count = (n: number) => (n > 1 ? ` · ${n} versions` : "");
  const tabs: { key: RunTab | "play"; label: string; href: string | null }[] = [
    { key: "review", label: "Ranking review", href: state("rank") === "done" || state("rank") === "copied" ? `/debug/runs/${runId}/review` : null },
    { key: "analysis", label: `Analysis${count(versions.analysis.length)}`, href: ran("extract") ? `/debug/runs/${runId}/analysis` : null },
    { key: "script", label: `Script${count(versions.script.length)}`, href: ran("plan") ? `/debug/runs/${runId}/script` : null },
    { key: "play", label: `Play episode${count(versions.audio.length)}`, href: assembled?.episodeId ? `/player/${assembled.episodeId}` : null },
  ];
  return (
    <nav className="runnav" aria-label="Run pages">
      {current === "run" ? (
        <Link href="/debug/runs" className="back">← All runs</Link>
      ) : (
        <Link href={`/debug/runs/${runId}`} className="back">← Run {runId}</Link>
      )}
      <span className="tabs">
        {tabs.map((t) =>
          t.key === current ? (
            <span key={t.key} className="tab on" aria-current="page">{t.label}</span>
          ) : t.href ? (
            <Link key={t.key} href={t.href} className="tab">{t.label}{t.key === "play" ? " ↗" : ""}</Link>
          ) : (
            <span key={t.key} className="tab off" title="Not run yet">{t.label}</span>
          ),
        )}
      </span>
    </nav>
  );
}
