import pipeline from "@config/pipeline.json";
import sourcesFile from "@config/sources.json";
import type { RunParams, Source } from "./types";

export type PipelineConfig = typeof pipeline;
export const config: PipelineConfig = pipeline;
export const staticSources = sourcesFile.sources as Source[];

export function vanillaParams(): RunParams {
  return structuredClone(config.vanilla) as RunParams;
}

export function priceFor(model: string) {
  const table = config.pricingPerMTok as Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }>;
  return table[model];
}
