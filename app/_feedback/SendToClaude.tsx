"use client";

import { useState } from "react";
import type { FeedbackArea } from "@/feedback/format";
import { sendFeedbackAction, type SendState } from "./actions";

interface Props {
  area: FeedbackArea;
  /** Sends with the same key while the issue is open add a comment to it (see src/feedback/format.ts). */
  threadKey?: string;
  title: string;
  /** The page's report (same text as "Copy report for Claude"). Left out for a plain note. */
  report?: string;
  data?: Record<string, unknown>;
  label?: string;
  /** Always show the note box (the "Note to Claude" card) instead of opening it from a button. */
  inline?: boolean;
  placeholder?: string;
}

/**
 * "Send to Claude": opens a note box; Send turns the page's report plus the note into a GitHub issue that Claude reads
 * at the start of each session. No copy and paste.
 */
export default function SendToClaude({ area, threadKey, title, report, data, label = "Send to Claude", inline, placeholder }: Props) {
  const [open, setOpen] = useState(!!inline);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SendState | null>(null);

  const send = async () => {
    setBusy(true);
    setResult(null);
    const page = typeof window === "undefined" ? undefined : window.location.pathname + window.location.search;
    const r = await sendFeedbackAction({ area, key: threadKey, title, note, report, data, page }).catch((e: unknown) => ({ ok: false as const, error: String(e) }));
    setBusy(false);
    setResult(r);
    if (r.ok) {
      setNote("");
      if (!inline) setTimeout(() => setOpen(false), 1200);
    }
  };

  const status = result && (
    result.ok
      ? <span className="ok send-status">{result.updated ? "Added to the open issue" : "Sent"} ✓ <a href={result.url} target="_blank" rel="noreferrer">view</a></span>
      : <span className="bad send-status" role="alert">{result.error}</span>
  );

  const box = (
    <div className={inline ? "send-inline" : "send-pop"} role={inline ? undefined : "dialog"} aria-label="Send to Claude">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={inline ? 4 : 3}
        placeholder={placeholder ?? (report ? "Anything to add? (optional: the report goes with it)" : "What should Claude know?")}
        autoFocus={!inline}
      />
      <div className="row" style={{ marginTop: 6, gap: 8, alignItems: "center" }}>
        <button type="button" className="primary" onClick={send} disabled={busy || (!report && !note.trim())}>{busy ? "Sending…" : "Send"}</button>
        {!inline && <button type="button" onClick={() => setOpen(false)}>Cancel</button>}
        {status}
      </div>
    </div>
  );

  if (inline) return box;
  return (
    <span className="send-wrap">
      <button type="button" className="primary" onClick={() => { setOpen((o) => !o); setResult(null); }} aria-expanded={open}>
        {label}
      </button>
      {open && box}
      {!open && result?.ok && status}
    </span>
  );
}
