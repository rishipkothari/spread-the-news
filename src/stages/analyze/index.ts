import type { ArticleAnalyzer } from "../types";
import { stubAnalyzer } from "./stub";

export const analyzers: Record<string, ArticleAnalyzer> = {
  [stubAnalyzer.id]: stubAnalyzer,
};
