import { getJson, listPaths, paths, putJson } from "@/lib/storage";
import type { StageId } from "./stages";
import { readStatus, updateStatus, type StageStatus } from "./status";

/**
 * Every finished analysis, script and audio run of a run is kept as a numbered version.
 *
 * The working files (runs/{id}/extract.json, script.json, …) are always the *active* version: every stage, page
 * and button reads them as before. When a phase finishes, its files are copied to
 * runs/{id}/versions/{phase}/{n}/… and recorded in runs/{id}/versions.json. "Use this version" copies a
 * snapshot back over the working files, so the next phase runs from it (e.g. a new script from analysis v1).
 * Pages can show any version read-only with ?v=n.
 */

export const PHASES = ["analysis", "script", "audio"] as const;
export type Phase = (typeof PHASES)[number];

export const PHASE_STAGES: Record<Phase, StageId[]> = {
  analysis: ["extract", "analyze", "synthesize"],
  script: ["plan", "script"],
  audio: ["voice", "assemble"],
};

/** Files per phase, relative to runs/{id}/. Directories end in "/" and hold one file per story or segment. */
const PHASE_FILES: Record<Phase, string[]> = {
  analysis: ["analysis-plan.json", "extract.json", "analyze.json", "synthesize.json", "extract/", "analyze/", "synthesize/"],
  script: ["plan.json", "script.json", "script-review.json", "script/"],
  audio: ["voice-plan.json", "voice.json", "assemble.json", "voice/"],
};

/** Files edited after a phase finishes (the user's script review): synced back into the active version before it's replaced. */
const MUTABLE_FILES: Partial<Record<Phase, string[]>> = { script: ["script-review.json"] };

export interface VersionInfo {
  n: number;
  createdAt: string;
  /** Stage statuses when it finished; restored when the version is made active again. */
  stages: Partial<Record<StageId, StageStatus>>;
  /** Versions of earlier phases that were active when this one ran. */
  basedOn: Partial<Record<Phase, number>>;
  episodeId?: string;
  /** True for a version saved from a run made before versions existed. */
  legacy?: boolean;
}

export interface Versions {
  analysis: VersionInfo[];
  script: VersionInfo[];
  audio: VersionInfo[];
  active: Partial<Record<Phase, number>>;
}

const root = (runId: string) => `runs/${runId}/`;
const indexPath = (runId: string) => `runs/${runId}/versions.json`;
const versionRoot = (runId: string, phase: Phase, n: number) => `runs/${runId}/versions/${phase}/${n}/`;

export function phaseOf(stage: StageId): Phase | null {
  return PHASES.find((p) => PHASE_STAGES[p].includes(stage)) ?? null;
}

export async function readVersions(runId: string): Promise<Versions> {
  const v = await getJson<Versions>(indexPath(runId));
  return { analysis: v?.analysis ?? [], script: v?.script ?? [], audio: v?.audio ?? [], active: v?.active ?? {} };
}

async function writeVersions(runId: string, v: Versions): Promise<void> {
  await putJson(indexPath(runId), v);
}

export function nextVersion(v: Versions, phase: Phase): number {
  return Math.max(0, ...v[phase].map((x) => x.n)) + 1;
}

/** Path of a phase file for viewing: the working file for the active version (or no version given), else the snapshot. */
export function versionedPath(runId: string, rel: string, phase: Phase, v: number | null | undefined, versions?: Versions): string {
  if (!v || versions?.active[phase] === v) return root(runId) + rel;
  return versionRoot(runId, phase, v) + rel;
}

/** All existing files of a phase under a base prefix, as paths relative to that prefix. */
async function phaseFiles(base: string, phase: Phase): Promise<string[]> {
  const out: string[] = [];
  for (const f of PHASE_FILES[phase]) {
    if (f.endsWith("/")) out.push(...(await listPaths(base + f)).map((p) => p.slice(base.length)));
    else if ((await getJson<unknown>(base + f)) != null) out.push(f);
  }
  return out;
}

async function copyFiles(fromBase: string, toBase: string, rels: string[]): Promise<void> {
  for (let i = 0; i < rels.length; i += 8) {
    await Promise.all(
      rels.slice(i, i + 8).map(async (rel) => {
        const data = await getJson<unknown>(fromBase + rel);
        if (data != null) await putJson(toBase + rel, data);
      }),
    );
  }
}

/** Save the working files of a finished phase as a new version and make it active. */
export async function snapshotPhase(runId: string, phase: Phase, extra: { legacy?: boolean } = {}): Promise<VersionInfo> {
  const [versions, status] = await Promise.all([readVersions(runId), readStatus(runId)]);
  const n = nextVersion(versions, phase);
  const episodeId = phase === "audio" ? (await getJson<{ episodeId?: string }>(root(runId) + "assemble.json"))?.episodeId : undefined;
  await copyFiles(root(runId), versionRoot(runId, phase, n), await phaseFiles(root(runId), phase));
  const basedOn: VersionInfo["basedOn"] = {};
  for (const p of PHASES.slice(0, PHASES.indexOf(phase))) if (versions.active[p]) basedOn[p] = versions.active[p];
  const info: VersionInfo = {
    n,
    createdAt: new Date().toISOString(),
    stages: Object.fromEntries(PHASE_STAGES[phase].map((s) => [s, status?.stages[s]])),
    basedOn,
    ...(episodeId ? { episodeId } : {}),
    ...(extra.legacy ? { legacy: true } : {}),
  };
  versions[phase] = [...versions[phase].filter((x) => x.n !== n), info].sort((a, b) => a.n - b.n);
  versions.active[phase] = n;
  await writeVersions(runId, versions);
  return info;
}

/** Copy edits made since the active version was saved (the script review) into its snapshot. */
async function syncMutable(runId: string, phase: Phase, versions: Versions): Promise<void> {
  const n = versions.active[phase];
  const files = MUTABLE_FILES[phase];
  if (!n || !files) return;
  await copyFiles(root(runId), versionRoot(runId, phase, n), files);
}

/**
 * Before a phase runs again: keep the current output. A run made before versions existed gets its finished output
 * saved as v1; otherwise the active version's later edits (review notes) are synced into it. Then per-version
 * files that a new run doesn't overwrite (the review) are cleared so they don't carry over to the new output.
 */
export async function prepareRerun(runId: string, phase: Phase): Promise<void> {
  const status = await readStatus(runId);
  // This phase and the ones it builds on: save finished output from before versions existed as v1.
  for (const p of PHASES.slice(0, PHASES.indexOf(phase) + 1)) {
    const versions = await readVersions(runId);
    if (!versions[p].length && status?.stages[PHASE_STAGES[p].at(-1)!]?.state === "done") await snapshotPhase(runId, p, { legacy: true });
  }
  await syncMutable(runId, phase, await readVersions(runId));
  for (const f of MUTABLE_FILES[phase] ?? []) await putJson(root(runId) + f, null);
}

/** Make version n the working copy: restore its files and stage statuses. Later phases keep their own active versions. */
export async function activateVersion(runId: string, phase: Phase, n: number): Promise<void> {
  const versions = await readVersions(runId);
  const info = versions[phase].find((x) => x.n === n);
  if (!info) throw new Error(`run ${runId} has no ${phase} version ${n}`);
  // Even when n is already active: a re-run that failed halfway may have overwritten some working files.
  if (versions.active[phase] !== n) await syncMutable(runId, phase, versions);
  // Files of the current version that the restored one lacks (e.g. a review) must not leak into it.
  for (const f of MUTABLE_FILES[phase] ?? []) await putJson(root(runId) + f, null);
  await copyFiles(versionRoot(runId, phase, n), root(runId), await phaseFiles(versionRoot(runId, phase, n), phase));
  versions.active[phase] = n;
  await writeVersions(runId, versions);
  await updateStatus(runId, (s) => {
    for (const stage of PHASE_STAGES[phase]) if (info.stages[stage]) s.stages[stage] = info.stages[stage];
  });
}

/** Called after every stage: when it's the last stage of a phase, the phase's output becomes a new version. */
export async function finishPhaseIfLast(runId: string, stage: StageId): Promise<void> {
  const phase = phaseOf(stage);
  if (phase && PHASE_STAGES[phase].at(-1) === stage) await snapshotPhase(runId, phase);
}
