import { config } from "@/lib/config";
import { llmSinglePass } from "./cluster/llm-single-pass";
import { rssFetcher } from "./fetch/rss";
import { headlineIndexV1 } from "./rank/headline-index-v1";
import { blobJsonRegistry } from "./sources/blob-json";
import { staticJsonRegistry } from "./sources/static-json";
import type { ArticleFetcher, SourceRegistry, StoryClusterer, StoryRanker } from "./types";

const registries: Record<string, SourceRegistry> = { [staticJsonRegistry.id]: staticJsonRegistry, [blobJsonRegistry.id]: blobJsonRegistry };
const fetchers: Record<string, ArticleFetcher> = { [rssFetcher.id]: rssFetcher };
const clusterers: Record<string, StoryClusterer> = { [llmSinglePass.id]: llmSinglePass };
const rankers: Record<string, StoryRanker> = { [headlineIndexV1.id]: headlineIndexV1 };

function pick<T>(table: Record<string, T>, id: string, stage: string): T {
  const impl = table[id];
  if (!impl) throw new Error(`No ${stage} implementation "${id}". Known: ${Object.keys(table).join(", ")}`);
  return impl;
}

export type Methods = typeof config.methods;

export const impls = {
  sources: (m: Methods) => pick(registries, m.sources, "sources"),
  fetch: (m: Methods) => pick(fetchers, m.fetch, "fetch"),
  cluster: (m: Methods) => pick(clusterers, m.cluster, "cluster"),
  rank: (m: Methods) => pick(rankers, m.rank, "rank"),
};
