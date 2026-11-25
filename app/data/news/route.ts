import { readNewsIndex } from "@/news/store";

// Public news data (src/news). Behind the same password gate as every page (proxy.ts) until public access is decided.
export const dynamic = "force-dynamic";

/** Every published day, newest first: date, run, story and voiced counts, whether it has an episode. */
export async function GET() {
  return Response.json(await readNewsIndex(), { headers: { "Cache-Control": "private, max-age=60" } });
}
