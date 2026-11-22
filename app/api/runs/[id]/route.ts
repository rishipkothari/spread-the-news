import { checkBearer } from "@/lib/auth";
import { getJson, paths } from "@/lib/storage";
import type { UsageEntry } from "@/lib/types";
import { STAGES } from "@/pipeline/stages";
import { readStatus } from "@/pipeline/status";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = checkBearer(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  const status = await readStatus(id);
  if (!status) return Response.json({ error: "not found" }, { status: 404 });
  const usage = (await getJson<UsageEntry[]>(paths.usage(id))) ?? [];
  const totalCostUsd = Math.round(usage.reduce((a, u) => a + (u.costUsd ?? 0), 0) * 10000) / 10000;
  const origin = new URL(req.url).origin;
  return Response.json({
    ...status,
    usage: { totalCostUsd, entries: usage },
    outputs: Object.fromEntries(STAGES.map((s) => [s, `runs/${id}/${s}.json`])),
    debug: `${origin}/debug/runs/${id}`,
  });
}
