"use client";

import type { NewsEpisode } from "@/news/types";
import { PauseIcon, PlayIcon } from "../../_ui/icons";
import { usePlayer } from "./player";
import { minutes } from "./sections";

/** The day's episode: the top stories with a short spoken intro and sign-off. Play replaces the queue. */
export default function EpisodeCard({ episode, dateLabel, isToday }: { episode: NewsEpisode; dateLabel: string; isToday: boolean }) {
  const p = usePlayer();
  const ids = episode.tracks.map((t) => t.id);
  const active = !!p.current && ids.includes(p.current.id) && p.queue.length === ids.length && p.queue.every((t, i) => t.id === ids[i]);
  const onPlay = () => (active ? p.toggle() : p.playAll(episode.tracks));
  return (
    <section className="episode" aria-label="Daily episode">
      <div className="episode-text">
        <p className="kicker">{isToday ? "Today's episode" : `Episode · ${dateLabel}`}</p>
        <h2 className="episode-title">The day in {episode.storyCount} {episode.storyCount === 1 ? "story" : "stories"}</h2>
        <ol className="episode-titles">
          {episode.titles.slice(0, 3).map((t) => <li key={t}>{t}</li>)}
          {episode.titles.length > 3 && <li className="more">and {episode.titles.length - 3} more</li>}
        </ol>
      </div>
      <div className="episode-cta">
        <button type="button" className="btn btn-primary btn-lg" onClick={onPlay}>
          {active && p.playing ? <PauseIcon size={18} /> : <PlayIcon size={18} />} {active && p.playing ? "Pause" : active ? "Resume" : "Play episode"}
        </button>
        <span className="episode-len">{minutes(episode.durationSec)}</span>
      </div>
    </section>
  );
}
