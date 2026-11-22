import type { Article, Category, HistoryStory, Source, SourceHealth, Story, UsageEntry } from "@/lib/types";

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

export type { Category };
