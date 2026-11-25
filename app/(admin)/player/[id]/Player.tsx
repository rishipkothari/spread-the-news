"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EpisodeChapter } from "@/lib/types";
import { chapterAt, formatClock, nextChapterStart, prevChapterStart } from "./chapters";

interface Props {
  episode: { id: string; date: string; title: string; durationSec: number; chapters: EpisodeChapter[] };
  src: string;
}

const SPEEDS = [1, 1.25, 1.5, 1.75, 2];
const SKIP_SEC = 15;

// Per-device conveniences only: resume position and speed. Storage can be missing (private mode), so every access is guarded.
function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function Player({ episode, src }: Props) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(episode.durationSec);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [resumedFrom, setResumedFrom] = useState<number | null>(null);
  const posKey = `stn:pos:${episode.id}`;
  const current = chapterAt(episode.chapters, time);

  const seek = useCallback((sec: number) => {
    const a = audio.current;
    if (!a) return;
    a.currentTime = Math.max(0, Math.min(sec, (a.duration || episode.durationSec) - 0.25));
    setTime(a.currentTime);
  }, [episode.durationSec]);

  const toggle = useCallback(() => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) a.play().catch((e: Error) => setError(e.message));
    else a.pause();
  }, []);

  // Restore speed and resume position.
  useEffect(() => {
    const s = Number(load("stn:speed"));
    if (SPEEDS.includes(s)) setSpeed(s);
  }, []);
  useEffect(() => {
    if (audio.current) audio.current.playbackRate = speed;
    save("stn:speed", String(speed));
  }, [speed]);

  // Lock screen / headphone controls.
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => audio.current?.play()],
      ["pause", () => audio.current?.pause()],
      ["seekbackward", (d) => seek((audio.current?.currentTime ?? 0) - (d.seekOffset ?? SKIP_SEC))],
      ["seekforward", (d) => seek((audio.current?.currentTime ?? 0) + (d.seekOffset ?? SKIP_SEC))],
      ["seekto", (d) => d.seekTime != null && seek(d.seekTime)],
      ["previoustrack", () => seek(prevChapterStart(episode.chapters, audio.current?.currentTime ?? 0))],
      ["nexttrack", () => {
        const n = nextChapterStart(episode.chapters, audio.current?.currentTime ?? 0);
        if (n != null) seek(n);
      }],
    ];
    for (const [action, fn] of handlers) {
      try {
        ms.setActionHandler(action, fn);
      } catch {
        /* action not supported on this browser */
      }
    }
    return () => {
      for (const [action] of handlers) {
        try {
          ms.setActionHandler(action, null);
        } catch {
          /* ignore */
        }
      }
    };
  }, [episode.chapters, seek]);

  // Lock-screen title follows the current story.
  const chapterTitle = current?.title;
  useEffect(() => {
    if (!("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: chapterTitle ?? episode.title, artist: "Spread the News", album: episode.title });
  }, [chapterTitle, episode.title]);

  const onTime = () => {
    const a = audio.current;
    if (!a) return;
    setTime(a.currentTime);
    if (Math.floor(a.currentTime) % 5 === 0) save(posKey, String(a.currentTime));
    if ("mediaSession" in navigator && a.duration && Number.isFinite(a.duration)) {
      try {
        navigator.mediaSession.setPositionState({ duration: a.duration, position: Math.min(a.currentTime, a.duration), playbackRate: a.playbackRate });
      } catch {
        /* ignore */
      }
    }
  };

  const onLoaded = () => {
    const a = audio.current;
    if (!a) return;
    if (a.duration && Number.isFinite(a.duration)) setDuration(a.duration);
    a.playbackRate = speed;
    const pos = Number(load(posKey));
    if (pos > 5 && pos < (a.duration || episode.durationSec) - 10) {
      a.currentTime = pos;
      setTime(pos);
      setResumedFrom(pos);
    }
  };

  const onEnded = () => {
    setPlaying(false);
    save(posKey, "0");
  };

  return (
    <div className="player">
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        onPlay={() => { setPlaying(true); setError(null); }}
        onPause={() => { setPlaying(false); save(posKey, String(audio.current?.currentTime ?? 0)); }}
        onTimeUpdate={onTime}
        onLoadedMetadata={onLoaded}
        onEnded={onEnded}
        onError={() => setError("The audio couldn't load. Reload the page; if it keeps failing, tell Claude.")}
      />

      <div className="now">{current ? current.title : "Ready"}</div>

      <input
        className="scrub"
        type="range"
        min={0}
        max={Math.max(1, duration)}
        step={1}
        value={Math.min(time, duration)}
        onChange={(e) => seek(Number(e.target.value))}
        aria-label="Position"
      />
      <div className="times mono"><span>{formatClock(time)}</span><span>−{formatClock(Math.max(0, duration - time))}</span></div>

      <div className="controls">
        <button type="button" onClick={() => seek(time - SKIP_SEC)} aria-label="Back 15 seconds">−15</button>
        <button type="button" className="play" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>{playing ? "❚❚" : "▶"}</button>
        <button type="button" onClick={() => seek(time + SKIP_SEC)} aria-label="Forward 15 seconds">+15</button>
        <button type="button" className="speed" onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])} aria-label="Playback speed">{speed}×</button>
      </div>
      {resumedFrom != null && !playing && time > 0 && (
        <p className="muted" style={{ textAlign: "center", fontSize: 13 }}>
          Picking up at {formatClock(resumedFrom)}. <button type="button" className="linkish" onClick={() => { seek(0); setResumedFrom(null); }}>Start over</button>
        </p>
      )}
      {error && <p className="bad" style={{ textAlign: "center" }}>{error}</p>}

      <ol className="chapters">
        {episode.chapters.map((c) => (
          <li key={c.segmentId} className={current?.segmentId === c.segmentId ? "on" : ""}>
            <button
              type="button"
              onClick={() => {
                seek(c.startSec);
                audio.current?.play().catch((e: Error) => setError(e.message));
              }}
            >
              <span className={c.kind === "story" ? "ch-title" : "ch-title muted"}>{c.title}</span>
              <span className="mono muted">{formatClock(c.startSec)}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
