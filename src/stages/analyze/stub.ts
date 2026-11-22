import type { ArticleAnalyzer } from "../types";

/** Free dry run: no LLM call, no facts. Used to exercise the pipeline wiring. */
export const stubAnalyzer: ArticleAnalyzer = {
  id: "stub",
  async analyze() {
    return { facts: [], usage: [] };
  },
};
