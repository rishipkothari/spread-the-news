import Anthropic from "@anthropic-ai/sdk";
import { FatalError } from "workflow";
import { LlmOutputError } from "@/lib/llm";
import { mergeStage, planUnits, runUnit } from "@/pipeline/phase1";
import { finishRun, markStageFailed, runStage } from "@/pipeline/run";
import type { FanoutStage, StageId } from "@/pipeline/stages";

/** Errors that retrying can't fix become FatalError so the step fails once instead of three more times. */
function fatalize(e: unknown): never {
  // Invalid LLM output was already retried once inside the call; don't pay for 3 more.
  if (e instanceof LlmOutputError) throw new FatalError(e.message);
  // Malformed request, bad key, no permission, unknown model.
  if (
    e instanceof Anthropic.BadRequestError ||
    e instanceof Anthropic.AuthenticationError ||
    e instanceof Anthropic.PermissionDeniedError ||
    e instanceof Anthropic.NotFoundError
  ) {
    throw new FatalError(e.message);
  }
  throw e;
}

export async function runStageStep(runId: string, stage: Exclude<StageId, FanoutStage>): Promise<void> {
  "use step";
  try {
    await runStage(runId, stage);
  } catch (e) {
    fatalize(e);
  }
}

export async function planUnitsStep(runId: string, stage: FanoutStage): Promise<string[]> {
  "use step";
  return planUnits(runId, stage);
}

export async function runUnitStep(runId: string, stage: FanoutStage, storyId: string): Promise<void> {
  "use step";
  try {
    await runUnit(runId, stage, storyId);
  } catch (e) {
    fatalize(e);
  }
}

export async function mergeStageStep(runId: string, stage: FanoutStage): Promise<void> {
  "use step";
  await mergeStage(runId, stage);
}

export async function markFailedStep(runId: string, stage: StageId, error: string): Promise<void> {
  "use step";
  await markStageFailed(runId, stage, error);
}

export async function finishRunStep(runId: string): Promise<void> {
  "use step";
  await finishRun(runId);
}
