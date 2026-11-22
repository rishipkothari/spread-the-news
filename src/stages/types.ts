import type { Article, Category, ExtractedText, Fact, HistoryStory, Source, SourceHealth, Story, StorySynthesis, UsageEntry } from "@/lib/types";

export interface TimeWindow {
  start: string;
  end: string;
}

export interface SourceRegistry {
  id: string;
  getSources(): Promise<Source[]>;
}

export interface FetchResult {
  articles: Article[];
  sourceHealth: SourceHealth;
}

export interface ArticleFetcher {
  id: string;
  fetch(sources: Source[], window: TimeWindow): Promise<FetchResult>;
}

export interface ClusterInput {
  articles: Article[];
  sources: Source[];
  history: HistoryStory[];
}

export interface ClusterResult {
  stories: Story[];
  articleTypes: Record<string, Article["articleType"]>;
  usage: Omit<UsageEntry, "stage" | "ms">[];
  warnings: string[];
}

export interface StoryClusterer {
  id: string;
  cluster(input: ClusterInput): Promise<ClusterResult>;
}

export interface RankInput {
  stories: Story[];
  articles: Article[];
  sources: Source[];
  sourceHealth: SourceHealth;
  windowEnd: string;
}

export interface StoryRanker {
  id: string;
  rank(input: RankInput): Story[];
}

// ---------- Phase 1 ----------

export type LlmUsageEntry = Omit<UsageEntry, "stage" | "ms">;

/** Gets an article's text. The stage runner handles caching by URL and the per-story fan-out. */
export interface ArticleTextExtractor {
  id: string;
  extract(article: Article, source: Source): Promise<ExtractedText>;
}

export interface AnalyzeInput {
  article: Article; // articleType is set (opinion is filtered out before this is called)
  text: ExtractedText; // textStatus is "full" or "partial"
  story: { id: string; title: string };
  sourceName: string;
}

/** Per-article facts, each with a verbatim supporting quote from the article text. */
export interface ArticleAnalyzer {
  id: string;
  analyze(input: AnalyzeInput): Promise<{ facts: Fact[]; usage: LlmUsageEntry[] }>;
}

export interface SynthesizeInput {
  story: Story;
  articles: {
    article: Article;
    sourceName: string;
    lean: Source["lean"];
    leanValue: number;
    textStatus: ExtractedText["textStatus"];
    facts: Fact[]; // empty for opinion pieces and articles without text
  }[];
  history: HistoryStory[]; // linked chain of earlier stories, oldest first (may be empty)
}

/** Per-story comparison across outlets: agreed facts, disputes, framing by side, recent background. */
export interface StorySynthesizer {
  id: string;
  synthesize(input: SynthesizeInput): Promise<{ synthesis: StorySynthesis; usage: LlmUsageEntry[] }>;
}

export type { Category };
