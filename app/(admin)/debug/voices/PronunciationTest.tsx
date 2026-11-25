"use client";

import { useEffect, useRef, useState } from "react";
import { buildTestReport, clipKey, PRONUNCIATION_TEST, TEST_VERSION, type Mark, type TestAnswers } from "@/audio/pronunciation-test";
import SendToClaude from "../../../_feedback/SendToClaude";
import { voiceClipAction } from "./pronunciation-actions";

const STORE = `pronunciation-test-${TEST_VERSION}`;
const EMPTY: TestAnswers = { marks: {}, notes: {}, errors: {} };
const ALL = PRONUNCIATION_TEST.flatMap((i) => i.variants.map((v) => ({ item: i.id, variant: v.id })));

/**
 * The one-time listening test (docs/pronunciation.md): play each version of each line, mark ✓ or ✗, send to Claude.
 * Marks are kept in this browser until sent, so a reload doesn't lose them.
 */
export default function PronunciationTest({ voice, provider }: { voice: string; provider: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [answers, setAnswers] = useState<TestAnswers>(EMPTY);
  const [srcs, setSrcs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [playing, setPlaying] = useState<string | null>(null);
  const [prep, setPrep] = useState<{ done: number; total: number } | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORE);
      if (saved) setAnswers({ ...EMPTY, ...JSON.parse(saved) });
    } catch { /* private window: start empty */ }
  }, []);
  const update = (fn: (a: TestAnswers) => TestAnswers) =>
    setAnswers((a) => {
      const next = fn(a);
      try { localStorage.setItem(STORE, JSON.stringify(next)); } catch { /* not saved; still works */ }
      return next;
    });

  const fetchClip = async (item: string, variant: string): Promise<string | null> => {
    const k = clipKey(item, variant);
    if (srcs[k]) return srcs[k];
    setLoading((l) => ({ ...l, [k]: true }));
    const r = await voiceClipAction(item, variant).catch((e: unknown) => ({ ok: false as const, error: String(e) }));
    setLoading((l) => ({ ...l, [k]: false }));
    if (r.ok) {
      setSrcs((s) => ({ ...s, [k]: r.src }));
      update((a) => { const errors = { ...a.errors }; delete errors[k]; return { ...a, errors }; });
      return r.src;
    }
    update((a) => ({ ...a, errors: { ...a.errors, [k]: r.error } }));
    return null;
  };

  const play = async (item: string, variant: string) => {
    const k = clipKey(item, variant);
    const a = audio.current;
    if (!a) return;
    if (playing === k && !a.paused) { a.pause(); return; }
    setHint(null);
    const src = srcs[k] ?? (await fetchClip(item, variant));
    if (!src) return;
    a.src = src;
    setPlaying(k);
    // Phones may refuse to start audio after a wait; preparing first (or a second tap) fixes it.
    a.play().catch(() => setHint("Ready: tap ▶ again to play."));
  };

  const prepareAll = async () => {
    const todo = ALL.filter(({ item, variant }) => !srcs[clipKey(item, variant)]);
    let done = 0;
    setPrep({ done, total: todo.length });
    const queue = [...todo];
    await Promise.all(Array.from({ length: 3 }, async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        await fetchClip(next.item, next.variant);
        setPrep({ done: ++done, total: todo.length });
      }
    }));
  };

  const mark = (k: string, m: Mark) => update((a) => {
    const marks = { ...a.marks };
    if (marks[k] === m) delete marks[k]; else marks[k] = m;
    return { ...a, marks };
  });

  const total = ALL.length;
  const marked = ALL.filter(({ item, variant }) => answers.marks[clipKey(item, variant)]).length;
  const report = buildTestReport(answers, voice, provider);

  return (
    <section style={{ marginTop: 32 }}>
      <h2>Pronunciation test</h2>
      <p className="muted">
        One-time check of what this voice ({voice}) says correctly. Each line comes in several versions: play each, mark <b>✓</b> if it sounds
        right or <b>✗</b> if not. Leave a version unmarked if you can&apos;t tell. Add a note where useful. When done, press Send to Claude.
        About {PRONUNCIATION_TEST.length} lines, 10 minutes. Your marks stay in this browser until you send.
      </p>
      <div className="row sticky" style={{ alignItems: "center", padding: "8px 0" }}>
        <button type="button" onClick={prepareAll} disabled={!!prep && prep.done < prep.total}>
          {prep && prep.done < prep.total ? `Preparing ${prep.done}/${prep.total}…` : "Prepare all clips"}
        </button>
        <span className="muted">{marked}/{total} marked{Object.keys(answers.errors).length ? ` · ${Object.keys(answers.errors).length} failed` : ""}</span>
        {hint && <span className="warn">{hint}</span>}
        <span style={{ flex: 1 }} />
        <SendToClaude area="pronunciation" threadKey={`pronunciation:test-${TEST_VERSION}`} title={`Pronunciation test ${TEST_VERSION}`} report={report} data={{ test: TEST_VERSION, voice, provider, marked, total }} />
      </div>
      <audio ref={audio} onEnded={() => setPlaying(null)} onPause={() => setPlaying(null)} preload="none" />

      {PRONUNCIATION_TEST.map((item) => (
        <div key={item.id} className="story">
          <div className="row">
            <b>{item.topic}</b>
            <span className="muted">should sound like {item.listenFor}</span>
          </div>
          <table className="pron">
            <tbody>
              {item.variants.map((x) => {
                const k = clipKey(item.id, x.id);
                const m = answers.marks[k];
                const err = answers.errors[k];
                return (
                  <tr key={k}>
                    <td style={{ width: 44 }}>
                      <button type="button" className="pron-play" onClick={() => play(item.id, x.id)} disabled={loading[k]} aria-label={`Play ${x.label}`}>
                        {loading[k] ? "…" : playing === k ? "❚❚" : "▶"}
                      </button>
                    </td>
                    <td>
                      <div><b>{x.label}</b>{x.markup ? <span className="muted"> · markup</span> : null}</div>
                      <div className="muted mono" style={{ fontSize: 12, overflowWrap: "anywhere" }}>{x.text}</div>
                      {err && <div className="bad" style={{ fontSize: 12 }}>Couldn&apos;t voice: {err}</div>}
                    </td>
                    <td style={{ width: 96, whiteSpace: "nowrap", textAlign: "right" }}>
                      <button type="button" className={`pron-mark${m === "ok" ? " on-ok" : ""}`} onClick={() => mark(k, "ok")} aria-pressed={m === "ok"} aria-label="Sounds right">✓</button>{" "}
                      <button type="button" className={`pron-mark${m === "bad" ? " on-bad" : ""}`} onClick={() => mark(k, "bad")} aria-pressed={m === "bad"} aria-label="Sounds wrong">✗</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <input
            type="text"
            placeholder="Note (optional)"
            value={answers.notes[item.id] ?? ""}
            onChange={(e) => update((a) => ({ ...a, notes: { ...a.notes, [item.id]: e.target.value } }))}
            style={{ width: "100%", boxSizing: "border-box", marginTop: 6 }}
          />
        </div>
      ))}
    </section>
  );
}
