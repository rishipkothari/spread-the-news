"use client";

import type { NewsEpisode } from "@/news/types";
import { PlayIcon } from "../../_ui/icons";
import { usePlayer } from "./player";
import { minutes } from "./sections";

export default function PlayEpisodeButton({ episode, label }: { episode: NewsEpisode; label: string }) {
  const p = usePlayer();
  return (
    <button type="button" className="btn btn-secondary btn-lg" onClick={() => p.playAll(episode.tracks)}>
      <PlayIcon size={16} /> {label} <span className="btn-note">{minutes(episode.durationSec)}</span>
    </button>
  );
}
