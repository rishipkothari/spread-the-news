"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, CloseIcon, DragIcon, NextIcon, PauseIcon, PlayIcon, PrevIcon } from "../../_ui/icons";
import { RATES, usePlayer } from "./player";
import { clock, sectionLabel } from "./sections";

/**
 * The player drawer: a slim bar on the bottom edge while something is queued; tap or pull it up for the
 * full player and the queue. Hidden when the queue is empty.
 */
export default function Drawer() {
  const p = usePlayer();
  const { current, open, setOpen } = p;
  const sheet = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.documentElement.classList.add("drawer-open");
    sheet.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("drawer-open");
    };
  }, [open, setOpen]);

  useEffect(() => {
    document.documentElement.classList.toggle("has-player", !!current);
  }, [current]);

  if (!current) {
    return p.toast ? <div className="toast" role="status">{p.toast}</div> : null;
  }

  const progress = p.duration ? Math.min(1, p.time / p.duration) : 0;
  const position = `${p.index + 1} of ${p.queue.length}`;
  const meta = [current.category ? sectionLabel(current.category) : current.kind === "story" ? null : "Daily episode", position].filter(Boolean).join(" · ");

  // Swipe down on the sheet's top to close it.
  const onTouchStart = (e: React.TouchEvent) => { startY.current = e.touches[0].clientY; };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current == null) return;
    setDragY(Math.max(0, e.touches[0].clientY - startY.current));
  };
  const onTouchEnd = () => {
    if (dragY > 90) setOpen(false);
    setDragY(0);
    startY.current = null;
  };

  return (
    <>
      {p.toast && <div className="toast" role="status">{p.toast}</div>}

      <div className="mini" role="region" aria-label="Player">
        <div className="mini-progress" style={{ transform: `scaleX(${progress})` }} />
        <button type="button" className="mini-main" onClick={() => setOpen(true)} aria-label="Open player and queue">
          <span className="mini-text">
            <span className="mini-title">{current.title}</span>
            <span className="mini-meta">{meta}</span>
          </span>
        </button>
        <div className="mini-ctrls">
          <button type="button" className="ib desk" onClick={p.prev} aria-label="Previous"><PrevIcon size={18} /></button>
          <button type="button" className="ib ib-solid" onClick={p.toggle} aria-label={p.playing ? "Pause" : "Play"}>
            {p.playing ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
          </button>
          <button type="button" className="ib" onClick={p.next} disabled={p.index >= p.queue.length - 1} aria-label="Next"><NextIcon size={18} /></button>
        </div>
      </div>

      <div className={`scrim${open ? " on" : ""}`} onClick={() => setOpen(false)} aria-hidden />
      <div
        ref={sheet}
        className={`sheet${open ? " on" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Player and queue"
        aria-hidden={!open}
        tabIndex={-1}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: "none" } : undefined}
      >
        <div className="sheet-top" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <span className="grab" aria-hidden />
          <button type="button" className="ib" onClick={() => setOpen(false)} aria-label="Close player"><ChevronDown size={22} /></button>
        </div>

        <div className="sheet-body">
          <section className="now">
            <p className="kicker">{meta}</p>
            <h2 className="now-title">{current.title}</h2>
            {current.storyId && (
              <Link href={`/story/${current.storyId}`} className="textlink" onClick={() => setOpen(false)}>Read the story →</Link>
            )}

            <div className="scrub">
              <input
                type="range"
                min={0}
                max={Math.max(1, Math.round(p.duration))}
                step={1}
                value={Math.min(Math.round(p.time), Math.round(p.duration) || 0)}
                onChange={(e) => p.seek(+e.target.value)}
                aria-label="Position"
                style={{ "--pct": `${progress * 100}%` } as React.CSSProperties}
              />
              <div className="times"><span>{clock(p.time)}</span><span>−{clock(Math.max(0, p.duration - p.time))}</span></div>
            </div>

            <div className="transport">
              <button type="button" className="ib ib-lg" onClick={p.prev} aria-label="Previous"><PrevIcon size={24} /></button>
              <button type="button" className="ib ib-solid ib-xl" onClick={p.toggle} aria-label={p.playing ? "Pause" : "Play"}>
                {p.playing ? <PauseIcon size={28} /> : <PlayIcon size={28} />}
              </button>
              <button type="button" className="ib ib-lg" onClick={p.next} disabled={p.index >= p.queue.length - 1} aria-label="Next"><NextIcon size={24} /></button>
            </div>

            <div className="speed" role="group" aria-label="Playback speed">
              {RATES.map((r) => (
                <button key={r} type="button" className={r === p.rate ? "on" : undefined} aria-pressed={r === p.rate} onClick={() => p.setRate(r)}>{r}×</button>
              ))}
            </div>

            {p.error && (
              <div className="player-error" role="alert">
                <span>{p.error}</span>
                {p.index < p.queue.length - 1 && <button type="button" className="textlink" onClick={p.next}>Skip to next</button>}
              </div>
            )}
          </section>

          <Queue />
        </div>
      </div>
    </>
  );
}

function Queue() {
  const p = usePlayer();
  const list = useRef<HTMLOListElement>(null);
  const [drag, setDrag] = useState<{ from: number; dy: number; h: number } | null>(null);
  const total = p.queue.reduce((a, t) => a + (t.durationSec || 0), 0);

  const target = drag ? Math.max(0, Math.min(p.queue.length - 1, drag.from + Math.round(drag.dy / drag.h))) : -1;

  const onDown = (i: number) => (e: React.PointerEvent) => {
    const row = (e.currentTarget as HTMLElement).closest("li");
    if (!row) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const y0 = e.clientY;
    const h = row.getBoundingClientRect().height;
    setDrag({ from: i, dy: 0, h });
    const move = (ev: PointerEvent) => setDrag({ from: i, dy: ev.clientY - y0, h });
    const up = (ev: PointerEvent) => {
      const to = Math.max(0, Math.min(p.queue.length - 1, i + Math.round((ev.clientY - y0) / h)));
      p.move(i, to);
      setDrag(null);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <section className="queue" aria-label="Queue">
      <div className="queue-head">
        <h3>Queue</h3>
        <span className="meta">{p.queue.length} {p.queue.length === 1 ? "story" : "stories"} · {clock(total)}</span>
      </div>
      <ol ref={list} className="queue-list">
        {p.queue.map((t, i) => {
          const shift = drag && i !== drag.from
            ? (drag.from < i && i <= target ? -drag.h : drag.from > i && i >= target ? drag.h : 0)
            : 0;
          const style = drag?.from === i ? { transform: `translateY(${drag.dy}px)`, zIndex: 2 } : shift ? { transform: `translateY(${shift}px)` } : undefined;
          return (
            <li key={t.id} className={`${i === p.index ? "cur" : i < p.index ? "played" : ""}${drag?.from === i ? " dragging" : ""}`} style={style}>
              <span className="handle" onPointerDown={onDown(i)} aria-label="Drag to reorder" role="button" tabIndex={-1}><DragIcon size={18} /></span>
              <button type="button" className="q-main" onClick={() => p.jump(i)} aria-current={i === p.index ? "true" : undefined}>
                <span className="q-title">{i === p.index && p.playing && <span className="eq" aria-hidden><i /><i /><i /></span>}{t.title}</span>
                <span className="q-meta">{t.category ? `${sectionLabel(t.category)} · ` : ""}{clock(t.durationSec)}</span>
              </button>
              <button type="button" className="ib ib-sm" onClick={() => p.remove(i)} aria-label={`Remove ${t.title}`}><CloseIcon size={16} /></button>
            </li>
          );
        })}
      </ol>
      <button type="button" className="clear" onClick={p.clear}>Clear queue</button>
    </section>
  );
}
