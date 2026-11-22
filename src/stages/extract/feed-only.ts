import { config } from "@/lib/config";
import type { ArticleTextExtractor } from "../types";

/** No network: the feed's own full text when long enough, else the RSS summary as headline_only. */
export const feedOnlyExtractor: ArticleTextExtractor = {
  id: "feed-only",
  async extract(article) {
    const base = { articleId: article.id, url: article.url, fetchedAt: new Date().toISOString() };
    if (article.feedText && article.feedText.length >= config.analysis.minTextChars) {
      return { ...base, text: article.feedText, textStatus: "full", extractor: "feed-content", chars: article.feedText.length };
    }
    const text = article.summary ?? undefined;
    return { ...base, text, textStatus: "headline_only", extractor: "rss-summary", chars: text?.length ?? 0, error: "feed-only: no page fetch" };
  },
};
