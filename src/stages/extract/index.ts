import type { ArticleTextExtractor } from "../types";
import { chainExtractor } from "./chain";
import { feedOnlyExtractor } from "./feed-only";

export const extractors: Record<string, ArticleTextExtractor> = {
  [feedOnlyExtractor.id]: feedOnlyExtractor,
  [chainExtractor.id]: chainExtractor,
  // Older runs recorded these ids (v2 = before Trafilatura joined the chain).
  "chain-v1": chainExtractor,
  "chain-v2": chainExtractor,
};
