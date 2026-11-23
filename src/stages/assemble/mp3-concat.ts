import { joinMp3 } from "@/audio/mp3";
import type { EpisodeAssembler } from "../types";

/** Joins segment MP3s frame by frame with silent frames between them. Needs every segment in the same format. */
export const mp3Concat: EpisodeAssembler = {
  id: "mp3-concat",
  assemble({ parts, pauseSec }) {
    const joined = joinMp3(parts.map((p) => ({ mp3: p.mp3 })), pauseSec);
    return {
      mp3: joined.mp3,
      durationSec: joined.durationSec,
      parts: joined.parts.map((p, i) => ({ segmentId: parts[i].segmentId, ...p })),
      format: joined.format,
    };
  },
};
