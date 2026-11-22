import type { ArticleTextExtractor } from "../types";
import { chainExtractor } from "./chain";
import { feedOnlyExtractor } from "./feed-only";

export const extractors: Record<string, ArticleTextExtractor> = {
  [feedOnlyExtractor.id]: feedOnlyExtractor,
  [chainExtractor.id]: chainExtractor,
  "chain-v1": chainExtractor, // older runs recorded this id
};
