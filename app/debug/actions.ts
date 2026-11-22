"use server";

import { redirect } from "next/navigation";
import { isStage } from "@/pipeline/stages";
import { rerunStage, startAnalysis, startRun } from "@/pipeline/start";

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

export async function analysisAction(formData: FormData) {
  const runId = String(formData.get("runId"));
  await startAnalysis(runId);
  redirect(`/debug/runs/${runId}`);
}
