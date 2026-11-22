import type { ArticleTextExtractor } from "../types";
import { chainV1Extractor } from "./chain-v1";
import { feedOnlyExtractor } from "./feed-only";

export const extractors: Record<string, ArticleTextExtractor> = {
  [feedOnlyExtractor.id]: feedOnlyExtractor,
  [chainV1Extractor.id]: chainV1Extractor,
};
