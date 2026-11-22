import type { ArticleAnalyzer } from "../types";
import { haikuFactsV1 } from "./haiku-facts-v1";
import { stubAnalyzer } from "./stub";

export const analyzers: Record<string, ArticleAnalyzer> = {
  [stubAnalyzer.id]: stubAnalyzer,
  [haikuFactsV1.id]: haikuFactsV1,
};
