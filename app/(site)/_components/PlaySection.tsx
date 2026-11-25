"use client";

import { useEffect, useState } from "react";
import { pickForLength } from "@/news/queue";
import type { NewsStoryCard } from "@/news/types";
import { PlayIcon } from "../../_ui/icons";
import { usePlayer } from "./player";
import { minutes } from "./sections";

const KEY = "prism.sectionMinutes";

/** "▶ Play World" with a 5 · 10 · 15 min picker: queues the top voiced stories that fit. */
export default function PlaySection({ label, cards, lengths, defaultLength, overflowSec }: { label: string; cards: NewsStoryCard[]; lengths: number[]; defaultLength: number; overflowSec: number }) {
  const p = usePlayer();
  const [len, setLen] = useState(defaultLength);
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(KEY));
      if (lengths.includes(v)) setLen(v);
    } catch {}
  }, [lengths]);
  const choose = (v: number) => {
    setLen(v);
    try { localStorage.setItem(KEY, String(v)); } catch {}
  };

  const tracks = pickForLength(cards, len, overflowSec);
  if (!cards.some((c) => c.track)) return null;
  const total = tracks.reduce((a, t) => a + t.durationSec, 0);

  return (
    <div className="playsection">
      <button type="button" className="btn btn-primary" onClick={() => p.playAll(tracks)}>
        <PlayIcon size={16} /> Play {label}
      </button>
      <div className="seg-ctl" role="group" aria-label="Length">
        {lengths.map((v) => (
          <button key={v} type="button" className={v === len ? "on" : undefined} aria-pressed={v === len} onClick={() => choose(v)}>{v} min</button>
        ))}
      </div>
      <span className="playsection-note">{tracks.length} {tracks.length === 1 ? "story" : "stories"} · {minutes(total)}</span>
    </div>
  );
}
