import Link from "next/link";
import { ArrowRight } from "../_ui/icons";

/** Landing: the brand and a way into the news. No stories or listening here; that's the news pages' job. */
export default function Landing() {
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
            <Link href="/news" className="btn btn-primary btn-lg">Read the news <ArrowRight size={16} /></Link>
          </div>
        </div>
      </section>

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

      <section className="lp-close">
        <h2>The day's news, in focus.</h2>
        <Link href="/news" className="btn btn-primary btn-lg">Read the news <ArrowRight size={16} /></Link>
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
