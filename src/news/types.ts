import type { Category, LeanGroup, LeanLabel } from "@/lib/types";

/**
 * Data for the public news pages (docs/ui-sketch.md §8), built from a run's saved stage output by
 * src/news/build.ts and stored under news/ (see docs/architecture.md, Storage).
 *
 *   news/index.json                 NewsIndex: every published day, newest first (date selector, infinite scroll)
 *   news/days/{date}.json           NewsDay: the day's story rows, section counts and episode
 *   news/stories/{publicId}.json    NewsStory: one story page (script, analysis, outlets)
 */

/** Covering outlets per side (distinct outlets, not articles). Drives the split bar. */
export type LeanCounts = Record<LeanGroup, number>;

/** One playable item in the player queue. `src` is a same-origin URL (served by app/audio/[...key]). */
export interface Track {
  /** Story public id, or `{episodeId}:{segmentId}` for intro/rundown/outro. */
  id: string;
  title: string;
  kind: "story" | "welcome" | "rundown" | "outro";
  category?: Category;
  /** Public story id (for "Read the story →"). */
  storyId?: string;
  durationSec: number;
  src: string;
}

/** A story row (docs/ui-sketch.md §5.4). */
export interface NewsStoryCard {
  /** `{date}-{storyId}`: unique across days; the story page is /story/{id}. */
  id: string;
  storyId: string;
  date: string;
  rank: number;
  title: string;
  category: Category;
  outletCount: number;
  lean: LeanCounts;
  hasAnalysis: boolean;
  hasScript: boolean;
  hasAudio: boolean;
  /** Audio length (only when hasAudio). */
  durationSec?: number;
  /** The track to queue (only when hasAudio). */
  track?: Track;
}

export interface NewsOutlet {
  sourceId: string;
  name: string;
  lean: LeanLabel;
  side: LeanGroup;
  headline: string;
  url: string;
  articleType?: "news" | "analysis" | "opinion";
}

export interface NewsAnalysis {
  summary: string;
  agreedFacts: string[];
  /** Where accounts differ: each position with the sides and outlets that hold it. */
  disputed: { claim: string; positions: { position: string; sides: LeanGroup[]; outlets: string[] }[] }[];
  /** How each side framed it; a side with no coverage is missing. */
  framing: Partial<Record<LeanGroup, string>>;
}

/** The story page (docs/ui-sketch.md §6.4). */
export interface NewsStory extends NewsStoryCard {
  runId: string;
  /** The script as read aloud, one entry per paragraph (only when hasScript). */
  script?: string[];
  analysis?: NewsAnalysis;
  /** Covering outlets, left to right, each with its own headline. */
  outlets: NewsOutlet[];
}

export interface NewsEpisode {
  id: string;
  durationSec: number;
  storyCount: number;
  /** Story titles in episode order (the card shows the first three). */
  titles: string[];
  /** The whole episode as one file. */
  src: string;
  /** The episode as separate tracks (intro, stories, outro), for "Play episode" into the queue. */
  tracks: Track[];
}

export interface NewsDay {
  date: string;
  runId: string;
  builtAt: string;
  /** 0 ranked only · 1 analysis · 2 script · 3 audio. A run replaces the day's published run only with at least the same progress (or when published by hand). */
  progress: number;
  /** Story rows: voiced first by rank, then the rest by rank. */
  stories: NewsStoryCard[];
  counts: { stories: number; voiced: number; bySection: Record<Category, number> };
  episode?: NewsEpisode;
}

export interface NewsIndexEntry {
  date: string;
  runId: string;
  stories: number;
  voiced: number;
  hasEpisode: boolean;
  builtAt: string;
}

export interface NewsIndex {
  /** Newest first. */
  days: NewsIndexEntry[];
}
