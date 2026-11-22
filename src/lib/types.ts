export type LeanLabel = "left" | "lean_left" | "center" | "lean_right" | "right";
export type LeanGroup = "left" | "center" | "right";
export type Category = "us" | "world" | "business" | "science" | "sports" | "other";
export type ArticleType = "news" | "analysis" | "opinion";
/** Feed type: "top" = editorial front page, "latest" = everything the outlet publishes, "section" = one topic. */
export type Prominence = "top" | "latest" | "section";
export const PROMINENCE_ORDER: Record<Prominence, number> = { top: 3, latest: 2, section: 1 };

export const CATEGORIES: Category[] = ["us", "world", "business", "science", "sports", "other"];
export const ARTICLE_TYPES: ArticleType[] = ["news", "analysis", "opinion"];

export interface Feed {
  url: string;
  section?: string;
  prominence: Prominence;
  verified?: boolean; // false = added but never fetched successfully yet
}

export interface Source {
  id: string;
  name: string;
  homepage: string;
  feeds: Feed[];
  lean: LeanLabel;
  leanValue: number; // -2..+2
  leanProvenance: { source: "allsides"; checkedOn: string; verified?: boolean };
  paywall: "none" | "metered" | "hard";
  fullTextInFeed: boolean;
  enabled: boolean;
}

export interface Article {
  id: string; // hash of canonical URL
  sourceId: string;
  url: string;
  title: string;
  summary?: string;
  feedText?: string;
  feedCategories: string[];
  section?: string;
  prominence: Prominence;
  publishedAt: string;
  homepageRank?: number; // 1-based position among article links on the outlet's homepage at fetch time
  articleType?: ArticleType;
  text?: string;
  textStatus?: "full" | "partial" | "headline_only";
  extractor?: string;
}

export interface StorySignals {
  outletCount: number; // distinct outlets, opinion-only outlets at 0.5
  distinctOutlets: number; // raw distinct outlets (for the min-outlets rule)
  coverage: number;
  balance: number;
  skew: number;
  prominence: number;
  recency: number;
  firstSeen: string;
  lastSeen: string;
  leanMix: Record<LeanGroup, number>; // covering outlets per group
}

export interface Story {
  id: string;
  title: string;
  category: Category;
  secondaryCategory?: Category;
  articleIds: string[];
  continuesStoryId?: string;
  signals?: StorySignals;
  headlineIndex: number;
  ranked?: boolean; // false when below minOutlets
}

export interface RunParams {
  lean: number;
  categories: Category[] | "all";
  targetDurationSec: number;
  storyCount?: { min: number; max: number };
  orderStrategy: string;
  scriptStyle: string;
}

export type SourceHealth = Record<
  string,
  {
    ok: boolean;
    items: number;
    inWindow: number;
    error?: string;
    feeds?: { url: string; ok: boolean; items: number; error?: string }[];
    homepage?: { ok: boolean; articleLinks: number; matched: number; error?: string };
  }
>;

export interface StoryBundle {
  runId: string;
  createdAt: string;
  window: { start: string; end: string };
  params: RunParams;
  methods: Record<string, string>;
  sources: Source[];
  sourceHealth: SourceHealth;
  articles: Article[];
  stories: Story[]; // sorted by headlineIndex
}

/** Rolling index entry used for cross-day linking. */
export interface HistoryStory {
  id: string;
  date: string;
  title: string;
  category: Category;
  summary?: string;
}

export interface UsageEntry {
  stage: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  costUsd?: number;
  ms: number;
  note?: string;
}
