import type { ArticleTextExtractor } from "../types";
import { feedOnlyExtractor } from "./feed-only";

export const extractors: Record<string, ArticleTextExtractor> = {
  [feedOnlyExtractor.id]: feedOnlyExtractor,
};
