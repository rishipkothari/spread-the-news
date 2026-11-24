"use server";

import { redirect } from "next/navigation";
import { isStage } from "@/pipeline/stages";
import { PHASES, activateVersion, type Phase } from "@/pipeline/versions";
import { rerunStage, rerunStages, startAnalysis, startAudio, startRun, startScript } from "@/pipeline/start";

// These run behind the password gate in proxy.ts (the debug pages' Basic auth).

export async function startRunAction(formData: FormData) {
  const mode = formData.get("mode");
  const status = await startRun(mode === "fetch-only" ? { stages: { through: "fetch" } } : {});
  redirect(`/debug/runs/${status.runId}`);
}

export async function replayAction(formData: FormData) {
  const runId = String(formData.get("runId"));
  const from = String(formData.get("from"));
  if (!isStage(from)) throw new Error(`unknown stage ${from}`);
  const status = await startRun({ replayFrom: runId, stages: { from } });
  redirect(`/debug/runs/${status.runId}`);
}

export async function rerankAction(formData: FormData) {
  const runId = String(formData.get("runId"));
  await rerunStage(runId, "rank");
  redirect(`/debug/runs/${runId}`);
}

/** Merge check on an existing run (e.g. one from before the check existed), then re-rank. */
export async function mergeAction(formData: FormData) {
  const runId = String(formData.get("runId"));
  await rerunStages(runId, ["merge", "rank"]);
  redirect(`/debug/runs/${runId}`);
}

export async function analysisAction(formData: FormData) {
  const runId = String(formData.get("runId"));
  await startAnalysis(runId);
  redirect(`/debug/runs/${runId}`);
}

export async function scriptAction(formData: FormData) {
  const runId = String(formData.get("runId"));
  await startScript(runId);
  redirect(`/debug/runs/${runId}`);
}

export async function audioAction(formData: FormData) {
  const runId = String(formData.get("runId"));
  await startAudio(runId);
  redirect(`/debug/runs/${runId}`);
}

/** Make an earlier (or later) analysis/script/audio version the current one. */
export async function activateVersionAction(formData: FormData) {
  const runId = String(formData.get("runId"));
  const phase = String(formData.get("phase")) as Phase;
  const n = Number(formData.get("n"));
  if (!PHASES.includes(phase) || !Number.isInteger(n)) throw new Error("bad version");
  await activateVersion(runId, phase, n);
  const back = String(formData.get("back") ?? "");
  redirect(back.startsWith("/debug/") ? back.replace(/([?&])v=\d+&?/, "$1").replace(/[?&]$/, "") : `/debug/runs/${runId}`);
}
