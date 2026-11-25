"use client";

import type { Track } from "@/news/types";
import { AddIcon, CheckIcon, PauseIcon, PlayIcon } from "../../_ui/icons";
import { usePlayer } from "./player";

/** Play and Add to queue for one story. `variant="row"` = compact icon buttons; `"page"` = labelled pills. */
export default function StoryActions({ track, variant = "row" }: { track: Track; variant?: "row" | "page" }) {
  const p = usePlayer();
  const isCurrent = p.current?.id === track.id;
  const isPlaying = isCurrent && p.playing;
  const queued = p.isQueued(track.id);
  const playLabel = isPlaying ? "Pause" : isCurrent ? "Resume" : "Play";

  if (variant === "page") {
    return (
      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={() => p.playNow(track)}>
          {isPlaying ? <PauseIcon size={16} /> : <PlayIcon size={16} />} {playLabel}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => p.add(track)} disabled={queued}>
          {queued ? <CheckIcon size={16} /> : <AddIcon size={16} />} {queued ? "In your queue" : "Add to queue"}
        </button>
      </div>
    );
  }
  return (
    <div className="row-actions">
      <button type="button" className={`ib ib-play${isCurrent ? " cur" : ""}`} onClick={(e) => { e.preventDefault(); p.playNow(track); }} aria-label={`${playLabel}: ${track.title}`}>
        {isPlaying ? <span className="eq" aria-hidden><i /><i /><i /></span> : <PlayIcon size={16} />}
      </button>
      <button type="button" className="ib" onClick={(e) => { e.preventDefault(); p.add(track); }} disabled={queued} aria-label={queued ? "In your queue" : `Add to queue: ${track.title}`}>
        {queued ? <CheckIcon size={18} /> : <AddIcon size={18} />}
      </button>
    </div>
  );
}
