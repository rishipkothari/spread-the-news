import { pickRange, isServableAudioPath } from "@/audio/range";
import { config } from "@/lib/config";
import { getRange, sizeOf } from "@/lib/storage";

/**
 * Streams private audio from Blob with HTTP Range support, behind the password gate in proxy.ts.
 * Responses are capped at config.audio.rangeChunkBytes so they stay under the function response limit;
 * the browser's audio player asks for the next range on its own.
 */

export const dynamic = "force-dynamic";

function cacheHeader(path: string): string {
  // audio/{hash}.mp3 never changes; an episode file is replaced when its audio is re-made.
  return path.startsWith("audio/") ? "private, max-age=86400, immutable" : "private, max-age=60";
}

async function serve(req: Request, ctx: { params: Promise<{ key: string[] }> }, body: boolean): Promise<Response> {
  const path = (await ctx.params).key.join("/");
  if (!isServableAudioPath(path)) return new Response("not found", { status: 404 });
  const size = await sizeOf(path);
  if (size == null) return new Response("not found", { status: 404 });
  if (!body && !req.headers.get("range")) {
    return new Response(null, { status: 200, headers: { "Content-Type": "audio/mpeg", "Accept-Ranges": "bytes", "Content-Length": String(size), "Cache-Control": cacheHeader(path) } });
  }
  const range = pickRange(req.headers.get("range"), size, config.audio.rangeChunkBytes);
  if (!range) return new Response("range not satisfiable", { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  const headers = {
    "Content-Type": "audio/mpeg",
    "Accept-Ranges": "bytes",
    "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
    "Content-Length": String(range.end - range.start + 1),
    "Cache-Control": cacheHeader(path),
  };
  if (!body) return new Response(null, { status: 206, headers });
  const stream = await getRange(path, range.start, range.end);
  if (!stream) return new Response("not found", { status: 404 });
  return new Response(stream, { status: 206, headers });
}

export async function GET(req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  return serve(req, ctx, true);
}

export async function HEAD(req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  return serve(req, ctx, false);
}
