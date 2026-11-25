import { getJson, paths } from "@/lib/storage";
import type { Episode, EpisodeScript } from "@/lib/types";
import type { NewsStory } from "@/news/types";
import { locateMoment } from "./format";

/** What the player knows about the track playing when "Flag this moment" was tapped. */
export interface MomentTrack {
  id: string;
  title: string;
  kind: "story" | "welcome" | "rundown" | "outro";
  storyId?: string;
  src: string;
  durationSec: number;
}

export interface MomentContext {
  date?: string;
  runId?: string;
  segmentId?: string;
  /** The text that was read for this track (story script or template segment). */
  text?: string;
  located?: ReturnType<typeof locateMoment>;
}

/** Finds the text behind a track so the flag can quote the sentence that was playing. Never throws. */
export async function momentContext(track: MomentTrack, atSec: number, durationSec: number): Promise<MomentContext> {
  try {
    let ctx: MomentContext = {};
    if (track.storyId) {
      const story = await getJson<NewsStory>(paths.newsStory(track.storyId));
      if (story) ctx = { date: story.date, runId: story.runId, segmentId: `seg-${story.storyId}`, text: story.script?.join("\n\n") };
    } else {
      // Template tracks: `{episodeId}:{segmentId}`.
      const [episodeId, segmentId] = track.id.split(":");
      const ep = episodeId ? await getJson<Episode>(paths.episode(episodeId)) : null;
      const script = ep ? await getJson<EpisodeScript>(paths.stage(ep.runId, "script")) : null;
      ctx = { date: ep?.date, runId: ep?.runId, segmentId, text: script?.segments.find((s) => s.id === segmentId)?.text };
    }
    if (ctx.text) ctx.located = locateMoment(ctx.text, atSec, durationSec || track.durationSec);
    return ctx;
  } catch {
    return {};
  }
}
