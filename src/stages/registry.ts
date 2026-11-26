import { config } from "@/lib/config";
import { llmSinglePass } from "./cluster/llm-single-pass";
import { rssFetcher } from "./fetch/rss";
import { headlineIndexV1 } from "./rank/headline-index-v1";
import { blobJsonRegistry } from "./sources/blob-json";
import { staticJsonRegistry } from "./sources/static-json";
import { analyzers } from "./analyze";
import { extractors } from "./extract";
import { synthesizers } from "./synthesize";
import { planners } from "./plan";
import { checkers, writers } from "./script";
import { ttsProviders } from "./tts";
import { speakers } from "./speak";
import { assemblers } from "./assemble";
import { mergers } from "./merge";
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
  // Runs from before the merge stage have no methods.merge; they get the config default.
  merge: (m: Methods) => pick(mergers, m.merge ?? config.methods.merge, "merge"),
  rank: (m: Methods) => pick(rankers, m.rank, "rank"),
  extract: (m: Methods) => pick(extractors, m.extract, "extract"),
  analyze: (m: Methods) => pick(analyzers, m.analyze, "analyze"),
  synthesize: (m: Methods) => pick(synthesizers, m.synthesize, "synthesize"),
  plan: (m: Methods) => pick(planners, m.plan, "plan"),
  script: (m: Methods) => pick(writers, m.script, "script"),
  check: (m: Methods) => pick(checkers, m.check, "check"),
  // Runs from before the spoken script have no methods.speak; they get the config default.
  speak: (m: Methods) => pick(speakers, m.speak ?? config.methods.speak, "speak"),
  tts: (m: Methods) => pick(ttsProviders, m.tts, "tts"),
  assemble: (m: Methods) => pick(assemblers, m.assemble, "assemble"),
};
