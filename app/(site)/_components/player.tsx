"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Track } from "@/news/types";
import { sectionLabel } from "./sections";

/**
 * The site's one player. Lives in the (site) layout, so audio keeps playing across pages.
 * Queue, position and speed are saved on this device and come back after a reload (paused).
 */

const KEY = "prism.player.v1";
const GAP_MS = 600; // pause between stories
export const RATES = [1, 1.25, 1.5, 2];

interface Saved { queue: Track[]; index: number; time: number; rate: number }

export interface PlayerApi {
  queue: Track[];
  index: number;
  current: Track | null;
  playing: boolean;
  time: number;
  duration: number;
  rate: number;
  error: string | null;
  open: boolean;
  toast: string | null;
  setOpen: (v: boolean) => void;
  /** Play now: goes right after the current story and starts; the rest of the queue stays. */
  playNow: (t: Track) => void;
  add: (t: Track) => void;
  /** Replace the queue (Play episode, Play this section). */
  playAll: (tracks: Track[], label?: string) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  jump: (i: number) => void;
  seek: (sec: number) => void;
  setRate: (r: number) => void;
  remove: (i: number) => void;
  move: (from: number, to: number) => void;
  clear: () => void;
  isQueued: (id: string) => boolean;
}

const Ctx = createContext<PlayerApi | null>(null);

export function usePlayer(): PlayerApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlayer outside PlayerProvider");
  return v;
}

function load(): Saved | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null") as Saved | null;
    if (!s || !Array.isArray(s.queue)) return null;
    return { queue: s.queue, index: Math.min(Math.max(0, s.index | 0), Math.max(0, s.queue.length - 1)), time: +s.time || 0, rate: RATES.includes(s.rate) ? s.rate : 1 };
  } catch {
    return null;
  }
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRateState] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const restored = useRef(false);
  const resumeAt = useRef(0); // position to seek to once the restored track loads
  const wantPlay = useRef(false); // play as soon as the current src is ready
  const gapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = queue[index] ?? null;

  // Restore after mount (localStorage isn't available during server render).
  useEffect(() => {
    const s = load();
    if (s && s.queue.length) {
      setQueue(s.queue);
      setIndex(s.index);
      setRateState(s.rate);
      resumeAt.current = s.time;
      setTime(s.time);
    }
    restored.current = true;
  }, []);

  // Save (time is saved by the timeupdate handler at most every few seconds).
  const lastSave = useRef(0);
  const save = useCallback((t?: number) => {
    if (!restored.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ queue, index, time: t ?? audio.current?.currentTime ?? 0, rate } satisfies Saved));
    } catch {}
  }, [queue, index, rate]);
  useEffect(() => save(), [save]);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  // Load the current track's audio when it changes.
  const src = current?.src;
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    setError(null);
    if (!src) {
      a.removeAttribute("src");
      a.load();
      setPlaying(false);
      setDuration(0);
      return;
    }
    if (a.getAttribute("src") !== src) {
      a.setAttribute("src", src);
      a.load();
      setDuration(current?.durationSec ?? 0);
      if (!resumeAt.current) setTime(0);
    }
    if (wantPlay.current) {
      wantPlay.current = false;
      a.play().catch(() => setPlaying(false));
    }
  }, [src]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (audio.current) audio.current.playbackRate = rate;
  }, [rate, src]);

  const start = useCallback((i: number) => {
    if (gapTimer.current) clearTimeout(gapTimer.current);
    resumeAt.current = 0;
    wantPlay.current = true;
    setIndex(i);
    // Same src as before (e.g. replaying the current story): the src effect won't fire.
    const a = audio.current;
    if (a && queue[i] && a.getAttribute("src") === queue[i].src) {
      wantPlay.current = false;
      a.currentTime = 0;
      a.play().catch(() => setPlaying(false));
    }
  }, [queue]);

  const playNow = useCallback((t: Track) => {
    if (current?.id === t.id) {
      const a = audio.current;
      if (a) (a.paused ? a.play().catch(() => {}) : a.pause());
      return;
    }
    if (gapTimer.current) clearTimeout(gapTimer.current);
    setQueue((q) => {
      const rest = q.filter((x) => x.id !== t.id);
      const cur = current ? rest.findIndex((x) => x.id === current.id) : -1;
      const at = cur + 1;
      const nq = [...rest.slice(0, at), t, ...rest.slice(at)];
      resumeAt.current = 0;
      wantPlay.current = true;
      setIndex(at);
      return nq;
    });
  }, [current]);

  const add = useCallback((t: Track) => {
    setQueue((q) => (q.some((x) => x.id === t.id) ? q : [...q, t]));
    flash(queue.some((x) => x.id === t.id) ? "Already in your queue" : "Added to queue");
  }, [flash, queue]);

  const playAll = useCallback((tracks: Track[]) => {
    if (!tracks.length) return;
    if (gapTimer.current) clearTimeout(gapTimer.current);
    resumeAt.current = 0;
    wantPlay.current = true;
    const a = audio.current;
    if (a && a.getAttribute("src") === tracks[0].src) {
      wantPlay.current = false;
      a.currentTime = 0;
      a.play().catch(() => {});
    }
    setQueue(tracks);
    setIndex(0);
  }, []);

  const toggle = useCallback(() => {
    const a = audio.current;
    if (!a || !current) return;
    if (a.paused) a.play().catch(() => setPlaying(false));
    else a.pause();
  }, [current]);

  const next = useCallback(() => {
    if (index < queue.length - 1) start(index + 1);
  }, [index, queue.length, start]);

  const prev = useCallback(() => {
    const a = audio.current;
    if (a && a.currentTime > 3) a.currentTime = 0;
    else if (index > 0) start(index - 1);
    else if (a) a.currentTime = 0;
  }, [index, start]);

  const seek = useCallback((sec: number) => {
    const a = audio.current;
    if (!a) return;
    a.currentTime = Math.max(0, Math.min(sec, a.duration || sec));
    setTime(a.currentTime);
  }, []);

  const setRate = useCallback((r: number) => setRateState(r), []);

  const remove = useCallback((i: number) => {
    setQueue((q) => {
      const nq = q.filter((_, j) => j !== i);
      if (i < index) setIndex(index - 1);
      else if (i === index) {
        // Removing the current story moves on to the next one (paused if nothing was playing).
        wantPlay.current = playing;
        resumeAt.current = 0;
        setIndex(Math.min(index, Math.max(0, nq.length - 1)));
      }
      return nq;
    });
  }, [index, playing]);

  const move = useCallback((from: number, to: number) => {
    if (from === to) return;
    setQueue((q) => {
      const nq = [...q];
      const [t] = nq.splice(from, 1);
      nq.splice(to, 0, t);
      if (from === index) setIndex(to);
      else if (from < index && to >= index) setIndex(index - 1);
      else if (from > index && to <= index) setIndex(index + 1);
      return nq;
    });
  }, [index]);

  const clear = useCallback(() => {
    audio.current?.pause();
    setQueue([]);
    setIndex(0);
    setOpen(false);
    try { localStorage.removeItem(KEY); } catch {}
  }, []);

  const isQueued = useCallback((id: string) => queue.some((t) => t.id === id), [queue]);

  // Lock-screen and headphone controls.
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    ms.metadata = current ? new MediaMetadata({ title: current.title, artist: "PRISM News", album: current.category ? sectionLabel(current.category) : "PRISM News", artwork: [{ src: "/brand/glasses-icon.jpg", sizes: "256x256", type: "image/jpeg" }] }) : null;
    const set = (a: MediaSessionAction, h: MediaSessionActionHandler | null) => { try { ms.setActionHandler(a, h); } catch {} };
    set("play", () => { audio.current?.play().catch(() => {}); });
    set("pause", () => audio.current?.pause());
    set("nexttrack", index < queue.length - 1 ? next : null);
    set("previoustrack", prev);
    set("seekbackward", () => seek((audio.current?.currentTime ?? 0) - 15));
    set("seekforward", () => seek((audio.current?.currentTime ?? 0) + 15));
    set("seekto", (d) => { if (d.seekTime != null) seek(d.seekTime); });
  }, [current, index, queue.length, next, prev, seek]);

  const api = useMemo<PlayerApi>(() => ({
    queue, index, current, playing, time, duration, rate, error, open, toast,
    setOpen, playNow, add, playAll, toggle, next, prev, jump: start, seek, setRate, remove, move, clear, isQueued,
  }), [queue, index, current, playing, time, duration, rate, error, open, toast, playNow, add, playAll, toggle, next, prev, start, seek, setRate, remove, move, clear, isQueued]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <audio
        ref={audio}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onLoadedMetadata={(e) => {
          const a = e.currentTarget;
          if (Number.isFinite(a.duration)) setDuration(a.duration);
          a.playbackRate = rate;
          if (resumeAt.current) {
            a.currentTime = Math.min(resumeAt.current, a.duration || resumeAt.current);
            resumeAt.current = 0;
          }
        }}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setTime(t);
          if (Date.now() - lastSave.current > 4000) {
            lastSave.current = Date.now();
            save(t);
          }
        }}
        onEnded={() => {
          setPlaying(false);
          if (index < queue.length - 1) {
            gapTimer.current = setTimeout(() => start(index + 1), GAP_MS);
          } else {
            save(0);
          }
        }}
        onError={() => {
          if (!audio.current?.getAttribute("src")) return;
          setPlaying(false);
          setError("Couldn't play this story.");
        }}
      />
    </Ctx.Provider>
  );
}

