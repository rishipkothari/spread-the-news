import { config } from "@/lib/config";
import { CATEGORIES, type Article, type Category, type Episode, type EpisodeScript, type LeanGroup, type Source, type StoryBundle, type StorySynthesis } from "@/lib/types";
import { pickArticles } from "@/pipeline/phase1";
import type { VoiceOut } from "@/pipeline/phase3";
import { leanGroup } from "@/stages/rank/headline-index-v1";
import type { LeanCounts, NewsAnalysis, NewsDay, NewsEpisode, NewsOutlet, NewsStory, NewsStoryCard, Track } from "./types";

/** Everything a run has saved that the public pages use. Missing phases are undefined. */
export interface RunNewsInputs {
  bundle: StoryBundle;
  syntheses?: StorySynthesis[];
  script?: EpisodeScript;
  voice?: VoiceOut;
  episode?: Episode;
}

const SIDES: LeanGroup[] = ["left", "center", "right"];
/** Listener-facing names for the episode's fixed parts. */
const TEMPLATE_TITLES: Record<string, string> = { welcome: "Welcome", rundown: "Today's stories", outro: "Sign-off" };

export const publicStoryId = (date: string, storyId: string) => `${date}-${storyId}`;
/** Splits `{date}-{storyId}`; null when it isn't one. */
export function parsePublicStoryId(id: string): { date: string; storyId: string } | null {
  const m = /^(\d{4}-\d{2}-\d{2})-(.+)$/.exec(id);
  return m ? { date: m[1], storyId: m[2] } : null;
}

/** The date a run's news belongs to (the end of its fetch window, UTC; same as the script and story history). */
export const runDate = (bundle: StoryBundle) => bundle.window.end.slice(0, 10);

export const audioSrc = (blobPath: string) => `/audio/${blobPath}`;

function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Build the day's rows and story pages from a run's saved output. Pure. */
export function buildNews(input: RunNewsInputs, builtAt = new Date().toISOString()): { day: NewsDay; stories: NewsStory[] } {
  const { bundle, syntheses = [], script, voice, episode } = input;
  const date = runDate(bundle);
  const sources = new Map<string, Source>(bundle.sources.map((s) => [s.id, s]));
  const articles = new Map<string, Article>(bundle.articles.map((a) => [a.id, a]));
  const synthById = new Map(syntheses.map((s) => [s.storyId, s]));
  const segByStory = new Map((script?.segments ?? []).filter((s) => s.kind === "story" && s.storyId).map((s) => [s.storyId!, s]));
  const unitBySeg = new Map((voice?.units ?? []).filter((u) => !u.error && u.audioKey).map((u) => [u.segmentId, u]));
  const minOutlets = config.news.minOutlets;

  const ranked = bundle.stories.filter((s) => s.ranked !== false);
  const stories: NewsStory[] = [];
  ranked.forEach((story, i) => {
    const picked = pickArticles(story, articles, Number.MAX_SAFE_INTEGER, (id) => sources.get(id)?.leanValue ?? 0);
    const outlets: NewsOutlet[] = picked
      .map((aid) => articles.get(aid)!)
      .filter((a) => sources.has(a.sourceId))
      .map((a) => {
        const src = sources.get(a.sourceId)!;
        return { sourceId: src.id, name: src.name, lean: src.lean, side: leanGroup(src.leanValue), headline: a.title, url: a.url, ...(a.articleType ? { articleType: a.articleType } : {}), _lv: src.leanValue };
      })
      .sort((x, y) => x._lv - y._lv || x.name.localeCompare(y.name))
      .map(({ _lv, ...o }) => o);
    if (outlets.length < minOutlets) return;

    const lean: LeanCounts = { left: 0, center: 0, right: 0 };
    for (const o of outlets) lean[o.side]++;
    const syn = synthById.get(story.id);
    const seg = segByStory.get(story.id);
    const unit = seg ? unitBySeg.get(seg.id) : undefined;
    const id = publicStoryId(date, story.id);
    const title = syn?.title ?? story.title;
    const track: Track | undefined = unit
      ? { id, title, kind: "story", category: story.category, storyId: id, durationSec: unit.durationSec ?? 0, src: audioSrc(`audio/${unit.audioKey}.mp3`) }
      : undefined;
    const nameOf = (sid: string) => sources.get(sid)?.name ?? sid;
    const analysis: NewsAnalysis | undefined = syn
      ? {
          summary: syn.summary,
          agreedFacts: syn.agreedFacts.map((f) => f.fact),
          disputed: syn.disputed
            .filter((d) => d.significance !== "minor")
            .map((d) => ({
              claim: d.claim,
              positions: d.positions.map((p) => ({
                position: p.position,
                sides: SIDES.filter((side) => p.sourceIds.some((sid) => sources.has(sid) && leanGroup(sources.get(sid)!.leanValue) === side)),
                outlets: p.sourceIds.map(nameOf),
              })),
            })),
          framing: syn.framing,
        }
      : undefined;
    stories.push({
      id,
      storyId: story.id,
      date,
      rank: i + 1,
      title,
      category: story.category,
      outletCount: outlets.length,
      lean,
      hasAnalysis: !!syn,
      hasScript: !!seg,
      hasAudio: !!track,
      ...(track ? { durationSec: track.durationSec, track } : {}),
      runId: bundle.runId,
      ...(seg ? { script: paragraphs(seg.text) } : {}),
      ...(analysis ? { analysis } : {}),
      outlets,
    });
  });

  const cards: NewsStoryCard[] = [...stories]
    .sort((a, b) => Number(b.hasAudio) - Number(a.hasAudio) || a.rank - b.rank)
    .map(({ runId: _r, script: _s, analysis: _a, outlets: _o, ...card }) => card);
  const bySection = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
  for (const c of cards) bySection[c.category]++;

  const newsEpisode = episode ? episodeOf(episode, stories, unitBySeg) : undefined;
  const progress = newsEpisode ? 3 : stories.some((s) => s.hasScript) ? 2 : stories.some((s) => s.hasAnalysis) ? 1 : 0;
  const day: NewsDay = {
    date,
    runId: bundle.runId,
    builtAt,
    progress,
    stories: cards,
    counts: { stories: cards.length, voiced: cards.filter((c) => c.hasAudio).length, bySection },
    ...(newsEpisode ? { episode: newsEpisode } : {}),
  };
  return { day, stories };
}

/** The episode as one file and as tracks. Each track is the cached segment audio the episode was joined from. */
function episodeOf(ep: Episode, stories: NewsStory[], unitBySeg: Map<string, VoiceOut["units"][number]>): NewsEpisode {
  const byStoryId = new Map(stories.map((s) => [s.storyId, s]));
  const tracks: Track[] = ep.chapters.map((ch) => {
    const story = ch.storyId ? byStoryId.get(ch.storyId) : undefined;
    if (ch.kind === "story" && story?.track) return story.track;
    const unit = unitBySeg.get(ch.segmentId);
    // Older episodes whose segment audio isn't recorded: play that stretch of the episode file (media fragment).
    const src = unit ? audioSrc(`audio/${unit.audioKey}.mp3`) : `${audioSrc(ep.audioPath)}#t=${ch.startSec},${+(ch.startSec + ch.durationSec).toFixed(2)}`;
    return {
      id: story ? story.id : `${ep.id}:${ch.segmentId}`,
      title: story?.title ?? TEMPLATE_TITLES[ch.kind] ?? ch.title,
      kind: ch.kind,
      ...(story ? { category: story.category, storyId: story.id } : {}),
      durationSec: ch.durationSec,
      src,
    };
  });
  const storyChapters = ep.chapters.filter((c) => c.kind === "story");
  return {
    id: ep.id,
    durationSec: ep.durationSec,
    storyCount: storyChapters.length,
    titles: storyChapters.map((c) => (c.storyId && byStoryId.get(c.storyId)?.title) || c.title),
    src: audioSrc(ep.audioPath),
    tracks,
  };
}
