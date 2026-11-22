"use server";

import { paths, putJson } from "@/lib/storage";
import { RunReview } from "@/review/types";

export async function saveReview(review: RunReview): Promise<{ ok: true; savedAt: string } | { ok: false; error: string }> {
  const parsed = RunReview.safeParse(review);
  if (!parsed.success) return { ok: false, error: parsed.error.message.slice(0, 300) };
  const savedAt = new Date().toISOString();
  await putJson(paths.review(parsed.data.runId), { ...parsed.data, savedAt });
  return { ok: true, savedAt };
}
