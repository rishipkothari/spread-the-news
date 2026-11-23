import Link from "next/link";
import { getJson, paths } from "@/lib/storage";
import type { EpisodePlan, EpisodeScript, UsageEntry } from "@/lib/types";
import type { ScriptUnit } from "@/pipeline/phase2";
import { readStatus } from "@/pipeline/status";
import { emptyScriptReview, type ScriptReview } from "@/review/script-types";
import ScriptClient from "./ScriptClient";

export const dynamic = "force-dynamic";

export default async function ScriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [status, plan, script, usage, saved] = await Promise.all([
    readStatus(id),
    getJson<EpisodePlan>(paths.stage(id, "plan")),
    getJson<EpisodeScript>(paths.stage(id, "script")),
    getJson<UsageEntry[]>(paths.usage(id)),
    getJson<ScriptReview>(paths.scriptReview(id)),
  ]);
  if (!status) return <main><h1>Run {id} not found</h1></main>;
  const units = plan
    ? (await Promise.all(plan.stories.map((s) => getJson<ScriptUnit>(paths.unit(id, "script", s.storyId))))).filter((u): u is ScriptUnit => !!u)
    : [];
  const running = (["plan", "script"] as const).some((s) => ["pending", "running"].includes(status.stages[s]?.state ?? ""));

  if (!plan) {
    return (
      <main>
        {running && <meta httpEquiv="refresh" content="5" />}
        <p className="muted"><Link href={`/debug/runs/${id}`}>← run</Link></p>
        <h1>No script yet</h1>
        <p className="muted">{running ? "Planning… this page refreshes every 5 seconds." : "Start it with \"Write script\" on the run page (needs a finished analysis)."}</p>
      </main>
    );
  }

  return (
    <ScriptClient
      runId={id}
      plan={plan}
      script={script}
      units={units}
      usage={usage ?? []}
      initial={saved ?? emptyScriptReview(id)}
      running={running}
      stageStates={`plan: ${status.stages.plan?.state ?? "–"} · script: ${status.stages.script?.state ?? "–"}`}
    />
  );
}
