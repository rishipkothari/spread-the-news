import type { StoryMerger } from "../types";
import { llmMergeV1, noMerge } from "./llm-merge-v1";

export const mergers: Record<string, StoryMerger> = { [llmMergeV1.id]: llmMergeV1, [noMerge.id]: noMerge };
