import { checkBearer } from "@/lib/auth";
import { isStage } from "@/pipeline/stages";
import { rerunStage } from "@/pipeline/start";

export async function POST(req: Request, ctx: { params: Promise<{ id: string; stage: string }> }) {
  const denied = checkBearer(req);
  if (denied) return denied;
  const { id, stage } = await ctx.params;
  if (!isStage(stage)) return Response.json({ error: `unknown stage ${stage}` }, { status: 400 });
  try {
    const status = await rerunStage(id, stage);
    return Response.json({ runId: id, stage, state: status.state }, { status: 202 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
