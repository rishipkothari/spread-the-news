import pipelineConfig from "@config/pipeline.json";
import { isFanout, type StageId } from "@/pipeline/stages";
import { finishRunStep, markFailedStep, mergeStageStep, planUnitsStep, runStageStep, runUnitStep } from "./steps";

/**
 * One run = the requested stages in order. Discovery stages are one durable step each;
 * Phase 1–2 stages fan out as one step per selected story (voice: per segment), then merge.
 */
export async function pipelineWorkflow(runId: string, stages: StageId[]) {
  "use workflow";
  for (const stage of stages) {
    try {
      if (isFanout(stage)) {
        const unitIds = await planUnitsStep(runId, stage);
        // Voice steps run a few at a time so the TTS service isn't hit with every segment at once.
        const batch = stage === "voice" ? Math.max(1, pipelineConfig.audio.concurrency) : unitIds.length || 1;
        for (let i = 0; i < unitIds.length; i += batch) {
          await Promise.all(unitIds.slice(i, i + batch).map((id) => runUnitStep(runId, stage, id)));
        }
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
