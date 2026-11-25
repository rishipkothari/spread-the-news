import Link from "next/link";
import { readNewsDay, readNewsIndex } from "@/news/store";
import { ArrowRight } from "../_ui/icons";
import PlayEpisodeButton from "./_components/PlayEpisodeButton";
import StoryRow from "./_components/StoryRow";
import { longDate } from "./_components/sections";

export const dynamic = "force-dynamic";

/** Landing: the brand, a way into the news, and a glimpse of the day's top stories. */
export default async function Landing() {
  const index = await readNewsIndex();
  const latest = index.days[0]?.date;
  const day = latest ? await readNewsDay(latest) : null;
  const top = [...(day?.stories ?? [])].sort((a, b) => a.rank - b.rank).slice(0, 3);
  const isToday = latest === new Date().toISOString().slice(0, 10);

  return (
    <main className="landing">
      <section className="hero">
        <div className="hero-art" aria-hidden>
          <img className="art-light" src="/brand/prism-light.webp" alt="" width={1376} height={768} />
          <img className="art-dark" src="/brand/glasses.jpg" alt="" width={1200} height={1200} />
        </div>
        <div className="hero-text">
          <p className="kicker">Refracting the headlines</p>
          <h1 className="hero-title">One story.<br /><em>Every lens.</em></h1>
          <p className="hero-sub">The news, fully framed. Bringing stories into focus.</p>
          <div className="hero-cta">
            <Link href="/news" className="btn btn-primary btn-lg">{isToday ? "Open today's news" : "Open the news"} <ArrowRight size={16} /></Link>
            {day?.episode && <PlayEpisodeButton episode={day.episode} label={isToday ? "Play today's episode" : "Play the latest episode"} />}
          </div>
        </div>
      </section>

      {top.length > 0 && (
        <section className="lp-top">
          <div className="lp-top-head">
            <div>
              <p className="kicker">{longDate(latest!)}</p>
              <h2>Top stories</h2>
            </div>
            <Link href="/news" className="textlink">All news →</Link>
          </div>
          <div className="rows">{top.map((s) => <StoryRow key={s.id} story={s} />)}</div>
        </section>
      )}

      <section className="pillars">
        <div className="pillar pillar-left">
          <h3>Every lens</h3>
          <p>Each story is read across outlets from left to right, so you see who covered it and how.</p>
        </div>
        <div className="pillar pillar-center">
          <h3>Facts first</h3>
          <p>What every side agrees on comes first. Where accounts differ, you see each version side by side.</p>
        </div>
        <div className="pillar pillar-right">
          <h3>Press play</h3>
          <p>Every top story is a short listen. Play one, queue a few, or a whole section. It keeps playing while you browse.</p>
        </div>
      </section>

      <footer className="site-footer">
        <div>
          <span className="brand-word">PRISM</span>
          <p>Refracting the headlines.</p>
        </div>
        <Link href="/debug" className="site-admin">Admin</Link>
      </footer>
    </main>
  );
}
