import { checkBearer } from "@/lib/auth";
import { missingEnv } from "@/lib/env";
import { listRunIds } from "@/lib/storage";
import { StartRunBody, startRun } from "@/pipeline/start";

export async function POST(req: Request) {
  const denied = checkBearer(req);
  if (denied) return denied;
  const missing = missingEnv();
  if (missing.length) return Response.json({ error: `missing env: ${missing.join(", ")}` }, { status: 500 });

  const raw = await req.text();
  const parsed = StartRunBody.safeParse(raw.trim() ? JSON.parse(raw) : {});
  if (!parsed.success) return Response.json({ error: parsed.error.issues }, { status: 400 });
  try {
    const status = await startRun(parsed.data);
    const origin = new URL(req.url).origin;
    return Response.json({ runId: status.runId, status: `${origin}/api/runs/${status.runId}`, debug: `${origin}/debug/runs/${status.runId}` }, { status: 202 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}

/** List recent run ids (newest first). */
export async function GET(req: Request) {
  const denied = checkBearer(req);
  if (denied) return denied;
  const ids = await listRunIds();
  return Response.json({ runs: ids.slice(0, 50) });
}
