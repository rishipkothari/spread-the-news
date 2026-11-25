"use client";

import { useState } from "react";
import { flagMomentAction, type SendState } from "../../_feedback/actions";
import { usePlayer } from "./player";
import { clock } from "./sections";

/**
 * "Flag this moment" in the full player: tapping records the track and second right away (it keeps playing),
 * then an optional note ("said reed, should be red") goes to Claude as a GitHub issue, one issue per day's listening.
 */
export default function FlagMoment() {
  const p = usePlayer();
  const [flag, setFlag] = useState<{ track: NonNullable<typeof p.current>; at: number; duration: number } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SendState | null>(null);

  if (!p.current) return null;

  const start = () => {
    setFlag({ track: p.current!, at: p.time, duration: p.duration });
    setNote("");
    setResult(null);
  };

  const send = async () => {
    if (!flag) return;
    setBusy(true);
    const { id, title, kind, storyId, src, durationSec } = flag.track;
    const r = await flagMomentAction({ id, title, kind, storyId, src, durationSec }, flag.at, flag.duration, note)
      .catch((e: unknown) => ({ ok: false as const, error: String(e) }));
    setBusy(false);
    setResult(r);
    if (r.ok) setFlag(null);
  };

  if (!flag) {
    return (
      <div className="flag">
        <button type="button" className="textlink" onClick={start}>Flag this moment for Claude</button>
        {result?.ok && <span className="flag-status">Sent ✓</span>}
      </div>
    );
  }

  return (
    <div className="flag flag-open">
      <p className="flag-at">Flagged at {clock(flag.at)} · {flag.track.title}</p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        autoFocus
        placeholder="What was off? e.g. said “reed”, should be “red”"
        aria-label="What was off"
      />
      <div className="flag-actions">
        <button type="button" className="btn btn-secondary" onClick={() => setFlag(null)}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={send} disabled={busy}>{busy ? "Sending…" : "Send to Claude"}</button>
      </div>
      {result && !result.ok && <p className="flag-error" role="alert">{result.error}</p>}
    </div>
  );
}
