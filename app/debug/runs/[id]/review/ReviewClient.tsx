"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, type Article, type LeanGroup, type Source, type Story, type StoryBundle, type UsageEntry } from "@/lib/types";
import { buildReport } from "@/review/report";
import { type RunReview, type StoryReview, type Verdict, VERDICT_LABEL, VERDICTS } from "@/review/types";
import { saveReview } from "../../../review-actions";

const GROUP_COLOR: Record<LeanGroup, string> = { left: "var(--left)", center: "var(--center)", right: "var(--right)" };
const leanColor = (v: number) => (v < 0 ? GROUP_COLOR.left : v > 0 ? GROUP_COLOR.right : GROUP_COLOR.center);
const pct = (n?: number) => (n == null ? "–" : `${Math.round(n * 100)}%`);

function LeanBar({ mix }: { mix: Record<LeanGroup, number> }) {
  const total = mix.left + mix.center + mix.right || 1;
  return (
    <span className="bar" title={`left ${mix.left} · center ${mix.center} · right ${mix.right}`}>
      {(["left", "center", "right"] as LeanGroup[]).map((g) => (
        <span key={g} style={{ width: `${(mix[g] / total) * 100}%`, background: GROUP_COLOR[g] }} />
      ))}
    </span>
  );
}

function ArticleList({ story, articles, sources }: { story: Story; articles: Map<string, Article>; sources: Map<string, Source> }) {
  return (
    <ul className="arts">
      {story.articleIds.map((id) => {
        const a = articles.get(id);
        if (!a) return null;
        const src = sources.get(a.sourceId);
        return (
          <li key={id}>
            <span className="dot" style={{ background: leanColor(src?.leanValue ?? 0) }} />
            <b>{src?.name ?? a.sourceId}</b> <span className="muted">[{a.articleType ?? "?"}]</span>{" "}
            <a href={a.url} target="_blank" rel="noreferrer">{a.title}</a>
          </li>
        );
      })}
    </ul>
  );
}

function StoryRow(props: {
  story: Story;
  rank: number;
  review: StoryReview | undefined;
  onChange: (r: StoryReview) => void;
  articles: Map<string, Article>;
  sources: Map<string, Source>;
}) {
  const { story, rank, articles, sources } = props;
  const r: StoryReview = props.review ?? { verdicts: [] };
  const [open, setOpen] = useState(false);
  const s = story.signals;
  const toggle = (v: Verdict) => {
    const has = r.verdicts.includes(v);
    let verdicts = has ? r.verdicts.filter((x) => x !== v) : [...r.verdicts, v];
    // "good" and the problem verdicts are mutually exclusive.
    if (!has) verdicts = v === "good" ? ["good"] : verdicts.filter((x) => x !== "good");
    props.onChange({ ...r, verdicts });
  };
  const reviewed = r.verdicts.length > 0;
  return (
    <div className="story" style={{ borderLeft: `4px solid ${reviewed ? (r.verdicts.includes("good") ? "var(--ok)" : "var(--warn)") : "var(--line)"}` }}>
      <div className="row">
        <span className="rank">{rank}</span>
        <span className="title">{story.title}</span>
        <span className="pill">{story.category}{story.secondaryCategory ? ` / ${story.secondaryCategory}` : ""}</span>
        {s && <LeanBar mix={s.leanMix} />}
        <span className="mono">{story.headlineIndex.toFixed(3)}</span>
      </div>
      {s && (
        <div className="signals">
          <span>{s.distinctOutlets} outlets</span>
          <span>{story.articleIds.length} articles</span>
          <span>coverage {pct(s.coverage)}</span>
          <span>balance {pct(s.balance)}</span>
          <span>prominence {pct(s.prominence)}</span>
          <span>skew {pct(s.skew)}</span>
          <span>recency {pct(s.recency)}</span>
          <button type="button" className="linkish" onClick={() => setOpen(!open)}>{open ? "hide articles" : "show articles"}</button>
        </div>
      )}
      {open && <ArticleList story={story} articles={articles} sources={sources} />}
      <div className="chips">
        {VERDICTS.map((v) => (
          <button key={v} type="button" className={`chip ${r.verdicts.includes(v) ? (v === "good" ? "on-good" : "on-bad") : ""}`} onClick={() => toggle(v)}>
            {VERDICT_LABEL[v]}
          </button>
        ))}
      </div>
      {(r.verdicts.includes("merge") || r.verdicts.includes("bad_category") || reviewed) && (
        <div className="row" style={{ marginTop: 6 }}>
          {r.verdicts.includes("merge") && (
            <input placeholder="same as story # (e.g. 4)" value={r.mergeWith ?? ""} onChange={(e) => props.onChange({ ...r, mergeWith: e.target.value || undefined })} style={{ width: 180 }} />
          )}
          {r.verdicts.includes("bad_category") && (
            <select value={r.category ?? ""} onChange={(e) => props.onChange({ ...r, category: (e.target.value || undefined) as StoryReview["category"] })}>
              <option value="">should be…</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <input placeholder="note (optional)" value={r.note ?? ""} onChange={(e) => props.onChange({ ...r, note: e.target.value || undefined })} style={{ flex: "1 1 240px" }} />
        </div>
      )}
    </div>
  );
}

export default function ReviewClient({ bundle, usage, warnings, initial }: { bundle: StoryBundle; usage: UsageEntry[]; warnings: string[]; initial: RunReview }) {
  const [review, setReview] = useState<RunReview>(initial);
  const [saveState, setSaveState] = useState<string>(initial.savedAt ? `saved ${new Date(initial.savedAt).toLocaleTimeString()}` : "not saved yet");
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState("");
  const dirty = useRef(false);

  const articles = useMemo(() => new Map(bundle.articles.map((a) => [a.id, a])), [bundle]);
  const sources = useMemo(() => new Map(bundle.sources.map((s) => [s.id, s])), [bundle]);
  const ranked = bundle.stories.filter((s) => s.ranked);
  const unranked = bundle.stories.filter((s) => !s.ranked);
  const storyOf = useMemo(() => {
    const m = new Map<string, string>();
    ranked.forEach((s, i) => s.articleIds.forEach((id) => m.set(id, `#${i + 1} ${s.title}`)));
    unranked.forEach((s) => s.articleIds.forEach((id) => m.set(id, `below minimum: ${s.title}`)));
    return m;
  }, [bundle]); // eslint-disable-line react-hooks/exhaustive-deps

  // Autosave 1.5s after the last change.
  useEffect(() => {
    if (!dirty.current) return;
    setSaveState("unsaved changes…");
    const t = setTimeout(async () => {
      const res = await saveReview(review);
      setSaveState(res.ok ? `saved ${new Date(res.savedAt).toLocaleTimeString()}` : `save failed: ${res.error}`);
    }, 1500);
    return () => clearTimeout(t);
  }, [review]);

  const update = (fn: (r: RunReview) => RunReview) => {
    dirty.current = true;
    setReview((r) => fn(r));
  };

  const report = useMemo(() => buildReport(bundle, usage, review, warnings), [bundle, usage, review, warnings]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      alert("Clipboard blocked — open 'Preview report' below and copy it by hand.");
    }
  };

  const reviewedCount = ranked.filter((s) => (review.stories[s.id]?.verdicts.length ?? 0) > 0).length;
  const q = query.trim().toLowerCase();
  const matches = q.length >= 3 ? bundle.articles.filter((a) => a.title.toLowerCase().includes(q)).slice(0, 40) : [];
  const failed = Object.entries(bundle.sourceHealth).filter(([, h]) => !h.ok);

  return (
    <main>
      <div className="sticky">
        <div className="row">
          <Link href={`/debug/runs/${bundle.runId}`} className="muted">← run</Link>
          <b className="mono">Review {bundle.runId}</b>
          <span className="muted">{reviewedCount}/{ranked.length} stories marked · {saveState}</span>
          <span style={{ flex: 1 }} />
          <button type="button" className="primary" onClick={copy}>{copied ? "Copied ✓ — paste it to Claude" : "Copy report for Claude"}</button>
        </div>
      </div>

      <h2>How to review</h2>
      <ol className="muted" style={{ marginTop: 0 }}>
        <li>Skim the ranked list. Open a news site or two and compare it with today&apos;s real headlines.</li>
        <li>Mark each story in roughly the top 15. <b>✓ Good</b> is fine for most; tag only the problems. Click &quot;show articles&quot; to check what was grouped together.</li>
        <li>Fill in the overall score and anything big that&apos;s missing. Use the search to see whether a missing story was fetched at all.</li>
        <li>Click <b>Copy report for Claude</b> and paste it into the chat. Your marks save automatically.</li>
      </ol>
      {failed.length > 0 && (
        <p className="warn">Failed sources this run: {failed.map(([id, h]) => `${sources.get(id)?.name ?? id} (${h.error})`).join("; ")}</p>
      )}

      <h2>Overall</h2>
      <div className="story">
        <div className="row">
          <span>How well does the top 10 match today&apos;s real headlines?</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" className={`chip ${review.overall === n ? "on-good" : ""}`} onClick={() => update((r) => ({ ...r, overall: r.overall === n ? 0 : n }))}>
              {n}
            </button>
          ))}
          <span className="muted">1 = unrecognizable · 5 = spot on</span>
        </div>
        <label className="field">
          <span>Big stories that are missing or ranked far too low</span>
          <textarea rows={2} value={review.missing} onChange={(e) => update((r) => ({ ...r, missing: e.target.value }))} placeholder="e.g. the Fed rate decision; the earthquake in Japan" />
        </label>
        <label className="field">
          <span>Anything else</span>
          <textarea rows={2} value={review.notes} onChange={(e) => update((r) => ({ ...r, notes: e.target.value }))} />
        </label>
      </div>

      <h2>Ranked stories ({ranked.length})</h2>
      {ranked.map((s, i) => (
        <StoryRow
          key={s.id}
          story={s}
          rank={i + 1}
          review={review.stories[s.id]}
          articles={articles}
          sources={sources}
          onChange={(sr) => update((r) => ({ ...r, stories: { ...r.stories, [s.id]: sr } }))}
        />
      ))}

      <h2>Below the 3-outlet minimum ({unranked.length})</h2>
      <p className="muted" style={{ marginTop: 0 }}>Tick any that are real headlines and deserved a rank.</p>
      <div className="story">
        {unranked.map((s) => (
          <label key={s.id} className="row" style={{ padding: "3px 0", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={review.shouldRank.includes(s.id)}
              onChange={(e) => update((r) => ({ ...r, shouldRank: e.target.checked ? [...r.shouldRank, s.id] : r.shouldRank.filter((x) => x !== s.id) }))}
            />
            <span style={{ flex: 1 }}>{s.title}</span>
            <span className="muted">{[...new Set(s.articleIds.map((id) => sources.get(articles.get(id)?.sourceId ?? "")?.name))].join(", ")}</span>
          </label>
        ))}
      </div>

      <h2>Search all fetched articles</h2>
      <input placeholder="type 3+ letters, e.g. tariff" value={query} onChange={(e) => setQuery(e.target.value)} style={{ width: "100%" }} />
      {matches.length > 0 && (
        <ul className="arts">
          {matches.map((a) => (
            <li key={a.id}>
              <span className="dot" style={{ background: leanColor(sources.get(a.sourceId)?.leanValue ?? 0) }} />
              <b>{sources.get(a.sourceId)?.name}</b> <a href={a.url} target="_blank" rel="noreferrer">{a.title}</a>
              <div className="muted" style={{ fontSize: 12 }}>→ {storyOf.get(a.id) ?? "not grouped into any story"}</div>
            </li>
          ))}
        </ul>
      )}
      {q.length >= 3 && matches.length === 0 && <p className="muted">No fetched article titles match. If it was big news, our sources didn&apos;t carry it in the window.</p>}

      <h2>Preview report</h2>
      <details>
        <summary className="muted" style={{ cursor: "pointer" }}>Show the text that gets copied</summary>
        <textarea readOnly value={report} rows={20} style={{ width: "100%", fontFamily: "ui-monospace, monospace", fontSize: 12 }} />
      </details>
    </main>
  );
}
