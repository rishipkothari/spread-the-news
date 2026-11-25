import { config } from "@/lib/config";
import type { Category } from "@/lib/types";
import { sectionCards } from "@/news/queue";
import { dayNeighbours, readNewsDay, readNewsIndex } from "@/news/store";
import DateNav from "./DateNav";
import EpisodeCard from "./EpisodeCard";
import PlaySection from "./PlaySection";
import SectionChips from "./SectionChips";
import StoryFeed from "./StoryFeed";
import { SECTIONS, longDate } from "./sections";

const isDate = (d?: string) => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);

/** News home and section pages: chips, date, (episode), Play this section, the story list with earlier days below. */
export default async function NewsView({ section, date }: { section: Category | "all"; date?: string }) {
  const index = await readNewsIndex();
  const latest = index.days[0]?.date;
  const chosen = isDate(date) ? date! : latest;
  const meta = section === "all" ? { label: "All news", blurb: "" } : SECTIONS.find((s) => s.id === section)!;

  if (!chosen) {
    return (
      <main className="news">
        <SectionChips current={section} />
        <div className="news-in"><p className="empty empty-lg">No stories yet. Check back soon.</p></div>
      </main>
    );
  }

  const day = await readNewsDay(chosen);
  const { older, newer } = dayNeighbours(index, chosen);
  const cards = sectionCards(day?.stories ?? [], section);
  const voiced = cards.filter((c) => c.hasAudio).length;
  const today = new Date().toISOString().slice(0, 10);
  const basePath = section === "all" ? "/news" : `/news/${section}`;
  const dateParam = chosen === latest ? undefined : chosen;

  return (
    <main className="news">
      <SectionChips current={section} date={dateParam} counts={day?.counts.bySection} />
      <div className="news-in">
        <DateNav basePath={basePath} date={chosen} older={older} newer={newer} latest={latest} />

        {section !== "all" && (
          <header className="section-head">
            <h1>{meta.label}</h1>
            <p>{meta.blurb}</p>
          </header>
        )}

        {section === "all" && day?.episode && <EpisodeCard episode={day.episode} dateLabel={longDate(chosen)} isToday={chosen === today} />}

        {cards.length > 0 && (
          <div className="list-head">
            <h2>{section === "all" ? "All news" : "Stories"}</h2>
            <span className="meta">{cards.length} {cards.length === 1 ? "story" : "stories"}{voiced ? ` · ${voiced} to listen to` : ""}</span>
          </div>
        )}
        {voiced > 0 && (
          <PlaySection
            label={section === "all" ? "all" : meta.label}
            cards={cards}
            lengths={config.news.sectionMinutes}
            defaultLength={config.news.defaultSectionMinutes}
            overflowSec={config.news.overflowSec}
          />
        )}

        <StoryFeed key={`${section}-${chosen}`} section={section} first={{ date: chosen, cards }} older={older ?? null} />
      </div>
    </main>
  );
}
