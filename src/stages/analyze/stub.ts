import type { ArticleAnalyzer } from "../types";

/** Free dry run: no LLM call. Returns the article's first sentence as a single fact, to exercise the pipeline wiring. */
export const stubAnalyzer: ArticleAnalyzer = {
  id: "stub",
  async analyze({ text }) {
    const first = (text.text ?? "").split(/(?<=[.!?])\s+/)[0]?.trim() ?? "";
    return { facts: first.length >= 12 ? [{ claim: first, quote: first, kind: "event" }] : [], usage: [] };
  },
};
