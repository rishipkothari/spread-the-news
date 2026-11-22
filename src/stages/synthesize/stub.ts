import type { StorySynthesizer } from "../types";

/** Free dry run: no LLM call; echoes the story title and outlet list. */
export const stubSynthesizer: StorySynthesizer = {
  id: "stub",
  async synthesize({ story, articles }) {
    const outlets = [...new Set(articles.map((a) => a.sourceName))].join(", ");
    return {
      synthesis: { storyId: story.id, title: story.title, summary: `${story.title} (covered by ${outlets}).`, agreedFacts: [], disputed: [], framing: {} },
      usage: [],
    };
  },
};
