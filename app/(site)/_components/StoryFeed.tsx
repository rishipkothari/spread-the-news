"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Category } from "@/lib/types";
import type { NewsDay, NewsStoryCard } from "@/news/types";
import StoryRow from "./StoryRow";
import { longDate } from "./sections";

interface Group { date: string; cards: NewsStoryCard[] }

/**
 * The chosen day's stories, then earlier days below as you scroll (each under a date line), back through every
 * day with news.
 */
export default function StoryFeed({ section, first, older, showRank }: { section: Category | "all"; first: Group; older: string | null; showRank?: boolean }) {
  const [groups, setGroups] = useState<Group[]>([first]);
  const [next, setNext] = useState<string | null>(older);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setGroups([first]);
    setNext(older);
    setFailed(false);
  }, [first, older]);

  const loadMore = useCallback(async () => {
    if (!next || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/data/news/${next}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { day: NewsDay | null; older: string | null };
      const cards = (data.day?.stories ?? []).filter((c) => section === "all" || c.category === section);
      setGroups((g) => (g.some((x) => x.date === next) ? g : [...g, { date: next, cards }]));
      setNext(data.older);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [next, loading, section]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !next || failed) return;
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) loadMore(); }, { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [next, failed, loadMore]);

  return (
    <div className="feed">
      {groups.map((g, gi) => (
        <section key={g.date} className="feed-day" aria-label={longDate(g.date)}>
          {gi > 0 && <h2 className="day-divider"><span>{longDate(g.date)}</span></h2>}
          {g.cards.length ? (
            <div className="rows">
              {g.cards.map((c) => <StoryRow key={c.id} story={c} showRank={showRank} showSection={section === "all"} />)}
            </div>
          ) : (
            <p className="empty">{gi === 0 ? "No stories for this day yet." : "No stories in this section that day."}</p>
          )}
        </section>
      ))}
      {next && !failed && (
        <div ref={sentinel} className="feed-more" aria-live="polite">
          {loading ? <span className="skeleton-rows" aria-label="Loading"><i /><i /><i /></span> : <button type="button" className="textlink" onClick={loadMore}>Earlier stories</button>}
        </div>
      )}
      {failed && (
        <div className="feed-more"><button type="button" className="textlink" onClick={() => { setFailed(false); loadMore(); }}>Couldn't load earlier stories. Try again</button></div>
      )}
      {!next && groups.length > 0 && <div className="feed-end" aria-hidden><span /></div>}
    </div>
  );
}
