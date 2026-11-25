import { start } from "workflow/api";
import { z } from "zod";
import { config, vanillaParams } from "@/lib/config";
import { newRunId } from "@/lib/hash";
import { CATEGORIES } from "@/lib/types";
import { pipelineWorkflow } from "@/workflows/pipeline";
import { copyStages, stagesBefore } from "./run";
import { ANALYSIS_STAGES, AUDIO_STAGES, DISCOVERY_STAGES, SCRIPT_STAGES, STAGES, stageRange, type StageId } from "./stages";
import { type RunStatus, clearUsage, readStatus, updateStatus, writeStatus } from "./status";
import { prepareRerun } from "./versions";

const stageEnum = z.enum(STAGES);

/** Episode profile fields; all optional, missing ones come from config `vanilla`. */
export const ProfileBody = z
  .object({
    lean: z.number().min(-2).max(2),
    categories: z.union([z.literal("all"), z.array(z.enum(CATEGORIES)), z.partialRecord(z.enum(CATEGORIES), z.number().min(0).max(100))]),
    targetDurationSec: z.number().positive(),
    storyCount: z.object({ min: z.number().int(), max: z.number().int() }),
    orderStrategy: z.string(),
    scriptStyle: z.string(),
  })
  .partial();

export const StartRunBody = z
  .object({
    params: ProfileBody.optional(),
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

/**
 * "Create run": the run's record with nothing started. Its page then offers "Find stories" (discovery) or
 * "Run full pipeline". Stages beyond discovery stay skipped until their phase is started.
 */
export async function createRun(): Promise<RunStatus> {
  const status: RunStatus = {
    runId: newRunId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    state: "created",
    params: vanillaParams(),
    methods: { ...config.methods },
    stages: Object.fromEntries(STAGES.map((s) => [s, { state: DISCOVERY_STAGES.includes(s) ? "pending" : "skipped" }])),
    errors: [],
  };
  await writeStatus(status);
  return status;
}

/** Start a created run: discovery only (sources → rank), or every phase through audio. */
export async function startCreatedRun(runId: string, scope: "discovery" | "everything"): Promise<RunStatus> {
  const s = await readStatus(runId);
  if (!s) throw new Error(`run ${runId} not found`);
  if (s.state !== "created") throw new Error(`run ${runId} has already started`);
  return rerunStages(runId, scope === "discovery" ? DISCOVERY_STAGES : [...STAGES]);
}

/** Re-run a single stage in place on an existing run (e.g. re-rank with new weights). */
export async function rerunStage(runId: string, stage: StageId): Promise<RunStatus> {
  return rerunStages(runId, [stage]);
}

/** Run Phase 1 (extract → analyze → synthesize) in place on a run that finished ranking. */
export async function startAnalysis(runId: string): Promise<RunStatus> {
  const s = await readStatus(runId);
  if (s?.stages.rank?.state !== "done" && s?.stages.rank?.state !== "copied") throw new Error(`run ${runId} hasn't finished ranking`);
  await prepareRerun(runId, "analysis");
  return rerunStages(runId, ANALYSIS_STAGES);
}

/**
 * Run Phase 2 (plan → script) in place on a run that has analysis. The episode profile is chosen here, at script time:
 * the generic episode (config `vanilla`) unless a profile is given. It's recorded as the run's params.
 */
export async function startScript(runId: string, profile: z.infer<typeof ProfileBody> = {}): Promise<RunStatus> {
  const s = await readStatus(runId);
  if (s?.stages.synthesize?.state !== "done") throw new Error(`run ${runId} has no finished analysis; run analysis first`);
  await prepareRerun(runId, "script");
  await updateStatus(runId, (st) => {
    st.params = { ...vanillaParams(), ...ProfileBody.parse(profile) };
  });
  return rerunStages(runId, SCRIPT_STAGES);
}

/** Run Phase 3 (voice → assemble) in place on a run with a finished script. Segments already voiced come from the audio cache. */
export async function startAudio(runId: string): Promise<RunStatus> {
  const s = await readStatus(runId);
  if (s?.stages.script?.state !== "done") throw new Error(`run ${runId} has no finished script; write the script first`);
  await prepareRerun(runId, "audio");
  return rerunStages(runId, AUDIO_STAGES);
}

export async function rerunStages(runId: string, stages: StageId[]): Promise<RunStatus> {
  const s = await readStatus(runId);
  if (!s) throw new Error(`run ${runId} not found`);
  await clearUsage(runId, stages);
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
