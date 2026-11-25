"use server";

import { redirect } from "next/navigation";
import { isStage } from "@/pipeline/stages";
import { publishRun, rebuildAllNews } from "@/news/store";
import { PHASES, activateVersion, type Phase } from "@/pipeline/versions";
import { createRun, rerunStage, rerunStages, startAnalysis, startAudio, startCreatedRun, startRun, startScript } from "@/pipeline/start";

// These run behind the password gate in proxy.ts (the debug pages' Basic auth).

/**
 * Buttons on /debug and /debug/runs. mode: "fetch-only" = check feeds (free); "create" = make the run without
 * starting anything (its page offers Find stories / Run full pipeline); "everything" = every phase through audio.
 */
export async function startRunAction(formData: FormData) {
  const mode = formData.get("mode");
  const status =
    mode === "fetch-only" ? await startRun({ stages: { through: "fetch" } })
    : mode === "everything" ? await startRun({ stages: { through: "assemble" } })
    : await createRun();
  redirect(`/debug/runs/${status.runId}`);
}

/** Start a created run from its page: discovery only, or the whole pipeline. */
export async function startCreatedAction(formData: FormData) {
  const runId = String(formData.get("runId"));
  await startCreatedRun(runId, formData.get("scope") === "everything" ? "everything" : "discovery");
  redirect(`/debug/runs/${runId}`);
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
  // The public pages follow the current version when this run is (or may become) its day's news.
  await publishRun(runId).catch((e) => console.error(`news: republish of ${runId} failed`, e));
  const back = String(formData.get("back") ?? "");
  redirect(back.startsWith("/debug/") ? back.replace(/([?&])v=\d+&?/, "$1").replace(/[?&]$/, "") : `/debug/runs/${runId}`);
}

/** Make this run its day's public news, replacing whatever run was there. */
export async function publishNewsAction(formData: FormData) {
  const runId = String(formData.get("runId"));
  await publishRun(runId, { force: true });
  redirect(`/debug/runs/${runId}`);
}

/** Rebuild the public news data from every saved run (per day: the run with the most progress, newest on a tie). */
export async function rebuildNewsAction() {
  await rebuildAllNews();
  redirect("/debug?news=rebuilt");
}
