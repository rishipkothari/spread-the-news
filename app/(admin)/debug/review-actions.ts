"use server";

import { paths, putJson } from "@/lib/storage";
import { readVersions, versionedPath } from "@/pipeline/versions";
import { RunReview } from "@/review/types";
import { ScriptReview } from "@/review/script-types";

export async function saveReview(review: RunReview): Promise<{ ok: true; savedAt: string } | { ok: false; error: string }> {
  const parsed = RunReview.safeParse(review);
  if (!parsed.success) return { ok: false, error: parsed.error.message.slice(0, 300) };
  const savedAt = new Date().toISOString();
  await putJson(paths.review(parsed.data.runId), { ...parsed.data, savedAt });
  return { ok: true, savedAt };
}

/** Saves to the current script's review, or with a saved script version when `version` is given. */
export async function saveScriptReview(review: ScriptReview, version?: number): Promise<{ ok: true; savedAt: string } | { ok: false; error: string }> {
  const parsed = ScriptReview.safeParse(review);
  if (!parsed.success) return { ok: false, error: parsed.error.message.slice(0, 300) };
  const savedAt = new Date().toISOString();
  const runId = parsed.data.runId;
  const path = version ? versionedPath(runId, "script-review.json", "script", version, await readVersions(runId)) : paths.scriptReview(runId);
  await putJson(path, { ...parsed.data, savedAt });
  return { ok: true, savedAt };
}
