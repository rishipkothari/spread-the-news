import { get, list, put } from "@vercel/blob";

/**
 * Thin JSON store over Vercel Blob. Paths are deterministic (no random suffix)
 * so stages can find each other's output; privacy comes from a private store.
 * Set BLOB_ACCESS=public only if the store was created as public.
 */
function access(): "public" | "private" {
  return process.env.BLOB_ACCESS === "public" ? "public" : "private";
}

export async function putJson(path: string, data: unknown): Promise<void> {
  await put(path, JSON.stringify(data), {
    access: access(),
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  });
}

export async function getJson<T>(path: string): Promise<T | null> {
  const res = await get(path, { access: access(), useCache: false });
  if (!res || res.statusCode !== 200 || !res.stream) return null;
  const text = await new Response(res.stream as ReadableStream).text();
  return JSON.parse(text) as T;
}

export async function listPaths(prefix: string, limit = 1000): Promise<string[]> {
  const out: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: Math.min(limit, 1000) });
    out.push(...page.blobs.map((b) => b.pathname));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor && out.length < limit);
  return out;
}

export const paths = {
  status: (runId: string) => `runs/${runId}/status.json`,
  stage: (runId: string, stage: string) => `runs/${runId}/${stage}.json`,
  bundle: (runId: string) => `runs/${runId}/bundle.json`,
  usage: (runId: string) => `runs/${runId}/usage.json`,
  review: (runId: string) => `runs/${runId}/review.json`,
  history: () => `history/stories-14d.json`,
  unit: (runId: string, stage: string, unitId: string) => `runs/${runId}/${stage}/${unitId}.json`,
  analysisPlan: (runId: string) => `runs/${runId}/analysis-plan.json`,
  textCache: (urlHash: string) => `cache/text/${urlHash}.json`,
};
