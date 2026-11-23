import Link from "next/link";
import { getJson, paths } from "@/lib/storage";
import type { EpisodePlan, EpisodeScript, UsageEntry } from "@/lib/types";
import type { ScriptUnit } from "@/pipeline/phase2";
import { readStatus } from "@/pipeline/status";
import { emptyScriptReview, type ScriptReview } from "@/review/script-types";
import { readVersions, versionedPath } from "@/pipeline/versions";
import VersionBar from "../VersionBar";
import ScriptClient from "./ScriptClient";

export const dynamic = "force-dynamic";

export default async function ScriptPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  const { id } = await params;
  const versions = await readVersions(id);
  const asked = Number((await searchParams).v) || null;
  // ?v=n views a saved version; the current version (or none given) reads the working files.
  const v = asked && versions.script.some((x) => x.n === asked) && asked !== versions.active.script ? asked : null;
  const at = (rel: string) => versionedPath(id, rel, "script", v, versions);
  const [status, plan, script, usage, saved] = await Promise.all([
    readStatus(id),
    getJson<EpisodePlan>(at("plan.json")),
    getJson<EpisodeScript>(at("script.json")),
    getJson<UsageEntry[]>(paths.usage(id)),
    getJson<ScriptReview>(at("script-review.json")),
  ]);
  if (!status) return <main><h1>Run {id} not found</h1></main>;
  const units = plan
    ? (await Promise.all(plan.stories.map((s) => getJson<ScriptUnit>(at(`script/${s.storyId}.json`))))).filter((u): u is ScriptUnit => !!u)
    : [];
  const versionBar = <VersionBar runId={id} phase="script" versions={versions} viewing={v} hrefFor={(n) => `/debug/runs/${id}/script?v=${n}`} />;
  const running = !v && (["plan", "script"] as const).some((s) => ["pending", "running"].includes(status.stages[s]?.state ?? ""));

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
      version={v ?? undefined}
      versionBar={versionBar}
      plan={plan}
      script={script}
      units={units}
      usage={v ? [] : (usage ?? [])}
      initial={saved ?? emptyScriptReview(id)}
      running={running}
      stageStates={v ? `version ${v}` : `plan: ${status.stages.plan?.state ?? "–"} · script: ${status.stages.script?.state ?? "–"}`}
    />
  );
}
