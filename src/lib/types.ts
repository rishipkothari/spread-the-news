export type LeanLabel = "left" | "lean_left" | "center" | "lean_right" | "right";
export type LeanGroup = "left" | "center" | "right";
export type Category = "us" | "world" | "business" | "science" | "sports" | "other";
export type ArticleType = "news" | "analysis" | "opinion";
/** Feed type: "top" = editorial front page, "latest" = everything the outlet publishes, "section" = one topic. */
export type Prominence = "top" | "latest" | "section";
export const PROMINENCE_ORDER: Record<Prominence, number> = { top: 3, latest: 2, section: 1 };

/** All section labels of an article (handles runs saved before `sections` existed). */
export function sectionsOf(a: Pick<Article, "sections" | "section">): string[] {
  return a.sections ?? (a.section ? [a.section] : []);
}

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
  /** Section labels of every feed of this outlet the article appeared in (e.g. ["us", "world"]); a category hint for the clusterer. */
  sections?: string[];
  /** Older runs: the first feed's section only. Read with sectionsOf(). */
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

/** Category share of an episode in percent, e.g. { us: 40, world: 30, science: 30 }. Missing categories get none. */
export type CategoryMix = Partial<Record<Category, number>>;

/**
 * The episode profile. The generic episode is every default (config `vanilla`); nothing special-cases it.
 * categories: "all" (rank decides), a list (only these), or a percentage mix.
 */
export interface RunParams {
  lean: number;
  categories: Category[] | CategoryMix | "all";
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
  continuesStoryId?: string; // link to an earlier history entry, to walk the chain
  summary?: string; // StorySynthesis.summary, added after the synthesize stage
}

// ---------- Phase 1: full text and story analysis ----------

export type TextStatus = "full" | "partial" | "headline_only";

/** Output of the extract stage for one article (also cached by URL). */
export interface ExtractedText {
  articleId: string;
  url: string;
  text?: string; // plain text; absent when headline_only and no summary
  textStatus: TextStatus;
  extractor: string; // which link of the chain produced it: "feed-content" | "readability" | "rss-summary" | …
  chars: number;
  error?: string; // why earlier links of the chain failed (paywall, robots, http, too short…)
  fetchedAt: string;
}

/** One fact from one article, with the exact sentence(s) that support it. */
export interface Fact {
  claim: string; // the fact, restated neutrally
  quote: string; // verbatim excerpt from the article text that supports it
  kind: "event" | "statistic" | "statement" | "background";
  speaker?: string; // for statements: who said it
}

export interface ArticleFacts {
  articleId: string;
  sourceId: string;
  storyId: string;
  facts: Fact[];
  skipped?: "opinion" | "no_text";
}

export interface StorySynthesis {
  storyId: string;
  title: string; // neutral title (may refine the clusterer's)
  summary: string; // 2–4 neutral sentences; also stored in story history
  agreedFacts: { fact: string; support: { articleId: string; quote: string }[] }[]; // reported by 2+ outlets
  singleSourceFacts?: { fact: string; sourceId: string; support: { articleId: string; quote: string }[] }[]; // one outlet only: attribute when used
  // significance: "material" changes what a listener understands; "minor" is a small mismatch. Missing (older runs) = material.
  disputed: { claim: string; significance?: "material" | "minor"; positions: { position: string; sourceIds: string[]; quote?: string; articleId?: string }[] }[];
  framing: Partial<Record<LeanGroup, string>>; // how each side frames it; omit a side with no coverage
  recently?: string; // "what happened recently", from the linked story chain
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

// ---------- Phase 2: episode plan and script ----------

export interface PlannedStory {
  storyId: string;
  title: string; // synthesis title
  category: Category;
  rank: number; // 1-based position in the run's ranked list
  lead: boolean; // first story of the episode
  wordBudget: number;
}

export interface EpisodePlan {
  planner: string;
  params: RunParams;
  orderStrategy: string;
  wordsPerMinute: number;
  targetWords: number;
  plannedWords: number;
  stories: PlannedStory[];
  skipped: { storyId: string; title: string; reason: string }[];
}

// "outlet_named": no longer raised (outlets may be named since 2026-11-27); kept so older runs still type-check.
export type CheckIssueKind = "unsupported" | "distorted" | "outlet_named" | "attribution" | "false_contrast" | "one_sided_dispute" | "missing_side" | "coverage_line" | "tone" | "ear" | "length" | "other";

export interface CheckIssue {
  kind: CheckIssueKind;
  severity: "must_fix" | "minor";
  excerpt: string; // the words in the segment the issue is about
  problem: string;
  fix?: string;
  source: "checker" | "code"; // LLM checker or deterministic code check
}

export interface CheckResult {
  pass: boolean;
  // support = material ids (F1, D1a, FR-left, H2…) that back the claim; related = closest material ids, shown to the writer on a rewrite
  claims: { claim: string; support: string[]; related?: string[]; status: "supported" | "unsupported" | "distorted" }[];
  issues: CheckIssue[];
  checker: string;
}

/** PRD Segment: one piece of an episode. scriptHash = hash of text, the key in the story bank. */
/** Fixed segments: welcome (generic show intro), rundown (this episode's story list), outro. */
export type TemplateKind = "welcome" | "rundown" | "outro";

export interface Segment {
  id: string;
  storyId?: string;
  kind: TemplateKind | "story";
  text: string;
  checkerResult: CheckResult | { pass: true; template: true };
  scriptHash: string;
  words: number;
}

export interface EpisodeScript {
  runId: string;
  date: string;
  params: RunParams;
  segments: Segment[];
  dropped: { storyId: string; title: string; reason: string }[];
  words: number;
  estMinutes: number;
  policy: { ok: boolean; reasons: string[] };
  errors: string[];
}

// ---------- Phase 3: audio and episodes ----------

/** One chapter of an episode: a segment's place in the joined audio. */
export interface EpisodeChapter {
  segmentId: string;
  kind: Segment["kind"];
  storyId?: string;
  title: string;
  startSec: number;
  durationSec: number;
}

/** PRD Episode. Stored at episodes/{id}.json with the audio at episodes/{id}.mp3. id = {date}-{paramsHash}. */
export interface Episode {
  id: string;
  date: string;
  runId: string;
  /** Which of the run's analysis, script and audio versions made it (absent on episodes made before versions existed). */
  version?: { audio: number; script?: number; analysis?: number };
  params: RunParams;
  createdAt: string;
  segmentIds: string[];
  chapters: EpisodeChapter[];
  audioPath: string;
  bytes: number;
  durationSec: number;
  voice: string;
  provider: string;
  format: { sampleRate: number; bitrate: number; mono: boolean };
  /** Story segments left out because they couldn't be voiced. */
  missing: { segmentId: string; title: string; reason: string }[];
}
