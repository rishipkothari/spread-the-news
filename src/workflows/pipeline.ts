import type { StageId } from "@/pipeline/stages";
import { finishRunStep, markFailedStep, runStageStep } from "./steps";

/** One run = the requested stages in order, each a durable, retried step. */
export async function pipelineWorkflow(runId: string, stages: StageId[]) {
  "use workflow";
  for (const stage of stages) {
    try {
      await runStageStep(runId, stage);
    } catch (e) {
      await markFailedStep(runId, stage, e instanceof Error ? e.message : String(e));
      return { runId, ok: false, failedStage: stage };
    }
  }
  await finishRunStep(runId);
  return { runId, ok: true };
}
