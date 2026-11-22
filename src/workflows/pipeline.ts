import { isFanout, type StageId } from "@/pipeline/stages";
import { finishRunStep, markFailedStep, mergeStageStep, planUnitsStep, runStageStep, runUnitStep } from "./steps";

/**
 * One run = the requested stages in order. Discovery stages are one durable step each;
 * Phase 1 stages fan out as one step per selected story, then merge.
 */
export async function pipelineWorkflow(runId: string, stages: StageId[]) {
  "use workflow";
  for (const stage of stages) {
    try {
      if (isFanout(stage)) {
        const storyIds = await planUnitsStep(runId, stage);
        await Promise.all(storyIds.map((id) => runUnitStep(runId, stage, id)));
        await mergeStageStep(runId, stage);
      } else {
        await runStageStep(runId, stage);
      }
    } catch (e) {
      await markFailedStep(runId, stage, e instanceof Error ? e.message : String(e));
      return { runId, ok: false, failedStage: stage };
    }
  }
  await finishRunStep(runId);
  return { runId, ok: true };
}
