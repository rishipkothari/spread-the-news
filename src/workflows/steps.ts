import Anthropic from "@anthropic-ai/sdk";
import { FatalError } from "workflow";
import { LlmOutputError } from "@/lib/llm";
import { finishRun, markStageFailed, runStage } from "@/pipeline/run";
import type { StageId } from "@/pipeline/stages";

export async function runStageStep(runId: string, stage: StageId): Promise<void> {
  "use step";
  try {
    await runStage(runId, stage);
  } catch (e) {
    // Invalid LLM output was already retried once inside the call; don't pay for 3 more.
    if (e instanceof LlmOutputError) throw new FatalError(e.message);
    // Malformed request, bad key, no permission, unknown model: retrying won't help.
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
}

export async function markFailedStep(runId: string, stage: StageId, error: string): Promise<void> {
  "use step";
  await markStageFailed(runId, stage, error);
}

export async function finishRunStep(runId: string): Promise<void> {
  "use step";
  await finishRun(runId);
}
