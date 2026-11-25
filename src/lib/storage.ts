import { BlobNotFoundError, get, head, list, put } from "@vercel/blob";

/**
 * Thin JSON store over Vercel Blob. Paths are deterministic (no random suffix)
 * so stages can find each other's output; privacy comes from a private store.
 * Set BLOB_ACCESS=public only if the store was created as public.
 */
function access(): "public" | "private" {
  return process.env.BLOB_ACCESS === "public" ? "public" : "private";
}

/**
 * Local development only: LOCAL_BLOB_DIR=/some/folder makes the JSON helpers read and write files there instead
 * of Blob (used to preview pages with sample data in a sandbox that can't reach Blob). Never set on Vercel.
 */
const localDir = () => (process.env.VERCEL ? undefined : process.env.LOCAL_BLOB_DIR);
async function localFs() {
  const [fs, nodePath] = await Promise.all([import("node:fs/promises"), import("node:path")]);
  return { fs, join: (p: string) => nodePath.join(localDir()!, p), dirname: nodePath.dirname };
}

export async function putJson(path: string, data: unknown): Promise<void> {
  if (localDir()) {
    const { fs, join, dirname } = await localFs();
    await fs.mkdir(dirname(join(path)), { recursive: true });
    await fs.writeFile(join(path), JSON.stringify(data));
    return;
  }
  await put(path, JSON.stringify(data), {
    access: access(),
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  });
}

export async function getJson<T>(path: string): Promise<T | null> {
  if (localDir()) {
    const { fs, join } = await localFs();
    try { return JSON.parse(await fs.readFile(join(path), "utf8")) as T; } catch { return null; }
  }
  const res = await get(path, { access: access(), useCache: false });
  if (!res || res.statusCode !== 200 || !res.stream) return null;
  const text = await new Response(res.stream as ReadableStream).text();
  return JSON.parse(text) as T;
}

/** Binary file (audio). Large files go up in parts. */
export async function putBytes(path: string, data: Uint8Array, contentType: string): Promise<void> {
  await put(path, Buffer.from(data.buffer, data.byteOffset, data.byteLength), {
    access: access(),
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    multipart: data.byteLength > 4_000_000,
  });
}

export async function getBytes(path: string): Promise<Uint8Array | null> {
  const res = await get(path, { access: access(), useCache: false });
  if (!res || res.statusCode !== 200 || !res.stream) return null;
  return new Uint8Array(await new Response(res.stream as ReadableStream).arrayBuffer());
}

/** Size in bytes, or null if the file doesn't exist. */
export async function sizeOf(path: string): Promise<number | null> {
  try {
    return (await head(path)).size;
  } catch (e) {
    if (e instanceof BlobNotFoundError) return null;
    throw e;
  }
}

/** A byte range of a file as a stream (for audio playback). Falls back to reading the whole file and slicing when the store doesn't honour the Range header. */
export async function getRange(path: string, start: number, end: number): Promise<ReadableStream | null> {
  const res = await get(path, { access: access(), useCache: true, headers: { range: `bytes=${start}-${end}` } });
  if (!res || res.statusCode !== 200 || !res.stream) return null;
  // The SDK reports a 206 as 200; Content-Range says whether the store served exactly this range.
  if (res.headers.get("content-range")?.startsWith(`bytes ${start}-${end}/`)) return res.stream as ReadableStream;
  let all: Uint8Array;
  if (res.headers.get("content-range")) {
    await res.stream.cancel();
    const full = await getBytes(path);
    if (!full) return null;
    all = full;
  } else {
    all = new Uint8Array(await new Response(res.stream as ReadableStream).arrayBuffer());
  }
  const slice = all.subarray(start, end + 1);
  return new ReadableStream({ start(c) { c.enqueue(slice); c.close(); } });
}

export async function listPaths(prefix: string, limit = 1000): Promise<string[]> {
  if (localDir()) {
    const { fs } = await localFs();
    const files = (await fs.readdir(localDir()!, { recursive: true }).catch(() => [] as string[])).map(String);
    return files.filter((f) => f.startsWith(prefix) && f.endsWith(".json")).slice(0, limit);
  }
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
  segment: (scriptHash: string) => `segments/${scriptHash}.json`,
  scriptReview: (runId: string) => `runs/${runId}/script-review.json`,
  voicePlan: (runId: string) => `runs/${runId}/voice-plan.json`,
  audio: (audioKey: string) => `audio/${audioKey}.mp3`,
  episode: (episodeId: string) => `episodes/${episodeId}.json`,
  episodeAudio: (episodeId: string) => `episodes/${episodeId}.mp3`,
  newsIndex: () => `news/index.json`,
  newsDay: (date: string) => `news/days/${date}.json`,
  newsStory: (publicId: string) => `news/stories/${publicId}.json`,
};
