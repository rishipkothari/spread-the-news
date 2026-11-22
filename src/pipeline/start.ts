import { start } from "workflow/api";
import { z } from "zod";
import { config, vanillaParams } from "@/lib/config";
import { newRunId } from "@/lib/hash";
import { CATEGORIES } from "@/lib/types";
import { pipelineWorkflow } from "@/workflows/pipeline";
import { copyStages, stagesBefore } from "./run";
import { ANALYSIS_STAGES, STAGES, stageRange, type StageId } from "./stages";
import { type RunStatus, readStatus, updateStatus, writeStatus } from "./status";

const stageEnum = z.enum(STAGES);

export const StartRunBody = z
  .object({
    params: z
      .object({
        lean: z.number().min(-2).max(2),
        categories: z.union([z.literal("all"), z.array(z.enum(CATEGORIES))]),
        targetDurationSec: z.number().positive(),
        storyCount: z.object({ min: z.number().int(), max: z.number().int() }),
        orderStrategy: z.string(),
        scriptStyle: z.string(),
      })
      .partial()
      .optional(),
    stages: z.object({ from: stageEnum.optional(), through: stageEnum.optional() }).optional(),
    replayFrom: z.string().optional(),
  })
  .strict();

export async function startRun(body: z.infer<typeof StartRunBody>): Promise<RunStatus> {
  const runId = newRunId();
  const from: StageId = body.stages?.from ?? (body.replayFrom ? "cluster" : STAGES[0]);
  const stages = stageRange(from, body.stages?.through);
  const replaySource = body.replayFrom ? await readStatus(body.replayFrom) : null;
  if (body.replayFrom && !replaySource) throw new Error(`replayFrom run ${body.replayFrom} not found`);
  if (!body.replayFrom && from !== STAGES[0]) throw new Error(`starting at "${from}" needs replayFrom`);

  const status: RunStatus = {
    runId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    state: "queued",
    params: { ...(replaySource?.params ?? vanillaParams()), ...body.params },
    methods: { ...config.methods },
    replayFrom: body.replayFrom,
    stages: Object.fromEntries(STAGES.map((s) => [s, { state: stages.includes(s) ? "pending" : "skipped" }])),
    errors: [],
  };
  await writeStatus(status);

  if (body.replayFrom) {
    const copied = stagesBefore(from);
    await copyStages(body.replayFrom, runId, copied);
    for (const s of copied) status.stages[s] = { state: "copied", summary: replaySource!.stages[s]?.summary };
    await writeStatus(status);
  }

  const wf = await start(pipelineWorkflow, [runId, stages]);
  return updateStatus(runId, (s) => {
    s.workflowRunId = wf.runId;
  });
}

/** Re-run a single stage in place on an existing run (e.g. re-rank with new weights). */
export async function rerunStage(runId: string, stage: StageId): Promise<RunStatus> {
  return rerunStages(runId, [stage]);
}

/** Run Phase 1 (extract → analyze → synthesize) in place on a run that finished ranking. */
export async function startAnalysis(runId: string): Promise<RunStatus> {
  const s = await readStatus(runId);
  if (s?.stages.rank?.state !== "done" && s?.stages.rank?.state !== "copied") throw new Error(`run ${runId} hasn't finished ranking`);
  return rerunStages(runId, ANALYSIS_STAGES);
}

export async function rerunStages(runId: string, stages: StageId[]): Promise<RunStatus> {
  const s = await readStatus(runId);
  if (!s) throw new Error(`run ${runId} not found`);
  const updated = await updateStatus(runId, (st) => {
    st.state = "queued";
    st.methods = { ...config.methods };
    for (const stage of stages) st.stages[stage] = { state: "pending" };
    st.errors = st.errors.filter((e) => !stages.some((stage) => e.startsWith(`${stage}:`)));
  });
  const wf = await start(pipelineWorkflow, [runId, stages]);
  updated.workflowRunId = wf.runId;
  await writeStatus(updated);
  return updated;
}
