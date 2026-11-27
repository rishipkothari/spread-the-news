import type { Article, Category, CheckResult, EpisodePlan, ExtractedText, Fact, HistoryStory, LeanGroup, RunParams, Source, SourceHealth, Story, StorySynthesis, UsageEntry } from "@/lib/types";

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

export interface MergeInput {
  stories: Story[];
  articles: Article[];
  sources: Source[];
}

/** One merge the merger made: `into` (the kept story's new id) absorbed `from` (the clustered story ids, larger first). */
export interface StoryMerge {
  into: string;
  from: string[];
  titles: string[];
  title: string;
  reason: string;
}

export interface MergeResult {
  stories: Story[];
  merges: StoryMerge[];
  warnings: string[];
  usage: Omit<UsageEntry, "stage" | "ms">[];
}

/** Runs after clustering: joins stories that are the same event or a direct follow-up of another. */
export interface StoryMerger {
  id: string;
  merge(input: MergeInput): Promise<MergeResult>;
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

// ---------- Phase 2 ----------

export interface PlanInput {
  stories: Story[]; // the run's stories in rank order (ranked and unranked)
  syntheses: StorySynthesis[];
  params: RunParams;
  /** What Phase 1 did, so a story without a synthesis gets a precise reason. */
  analysis?: { analyzedIds: string[]; headlinesOnly: string[]; errors: Record<string, string> };
}

/** Picks and orders the episode's stories and gives each a word budget. Pure: no LLM, no I/O. */
export interface EpisodePlanner {
  id: string;
  plan(input: PlanInput): Omit<EpisodePlan, "planner">;
}

/** Everything the writer and checker know about one story. Outlets appear only by side. */
export interface ScriptInput {
  story: { id: string; title: string; category: Category };
  synthesis: StorySynthesis;
  sideOf: Record<string, LeanGroup>; // sourceId → side, for every outlet that covered the story
  nameOf: Record<string, string>; // sourceId → on-air name ("The Guardian"), for every outlet in sideOf
  headlines: { text: string; side: LeanGroup; outlet?: string }[]; // covering outlets' own headlines (citable for identities and basic context)
  whoIsWho: string[]; // role phrases for people in this story, found in other stories' material today ("Transportation Secretary Sean Duffy")
  coverage: Record<LeanGroup, number>; // covering outlets per side
  coveringNames?: Record<LeanGroup, string[]>; // their on-air names, per side
  wordBudget: number;
  lead: boolean;
  includeRecently: boolean;
}

export interface Revision {
  text: string; // the draft that failed
  issues: CheckResult["issues"];
  claims: CheckResult["claims"];
}

/** Writes one story segment for the ear, following docs/tone-guide.md. */
export interface ScriptWriter {
  id: string;
  write(input: ScriptInput, revision?: Revision): Promise<{ text: string; usage: LlmUsageEntry[] }>;
}

/** Traces every claim in a segment to the story material and checks tone. Code-level checks are added by the runner. */
export interface ScriptChecker {
  id: string;
  check(input: ScriptInput, text: string): Promise<{ result: CheckResult; usage: LlmUsageEntry[] }>;
}

export type { Category };

// ---------- Phase 3: audio ----------

export interface TtsVoice {
  id: string; // provider's voice name, e.g. "en-US-AndrewNeural"
  label: string; // friendly name for the voice test page
  locale: string;
  gender?: string;
}

/** Turns text into MP3 audio. Every call must return the same output format for the same provider, so segments can be joined. */
export interface TTSProvider {
  id: string;
  /** Short format id, part of the audio cache key (e.g. "mp3-24k-48k-mono"). */
  format: string;
  synthesize(text: string, voice: string): Promise<Uint8Array>;
  /**
   * Voices a short SSML fragment as is (tags such as <phoneme>, <sub>, <break> are passed through, not escaped).
   * Optional: only providers that accept markup. Used by the pronunciation test on /debug/voices.
   */
  synthesizeMarkup?(ssmlFragment: string, voice: string): Promise<Uint8Array>;
  voices(): Promise<TtsVoice[]>;
}

export interface AssembleInput {
  parts: { segmentId: string; mp3: Uint8Array }[];
  pauseSec: number;
}

/** Joins voiced segments into one episode file. Pure: no I/O. */
export interface EpisodeAssembler {
  id: string;
  assemble(input: AssembleInput): {
    mp3: Uint8Array;
    durationSec: number;
    parts: { segmentId: string; startSec: number; durationSec: number }[];
    format: { sampleRate: number; bitrate: number; mono: boolean };
  };
}

/** Phase 3, before voicing: the spoken text of each segment (docs/pronunciation.md, src/audio/spoken.ts). */
export interface SpeakInput {
  segments: { id: string; kind: string; storyId?: string; text: string }[];
}
export interface SpeakResult {
  segments: import("@/audio/spoken").SpokenSegment[];
  usage: Omit<UsageEntry, "stage" | "ms">[];
  warnings: string[];
}
export interface SpokenScriptWriter {
  id: string;
  speak(input: SpeakInput): Promise<SpeakResult>;
}
