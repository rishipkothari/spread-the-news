import Link from "next/link";

/** Public landing page. Links only to the admin console until the news pages exist (docs/ui-sketch.md). */
export default function Landing() {
  return (
    <div className="landing">
      <header className="lp-header">
        <span className="wordmark">PRISM</span>
        <Link href="/debug" className="lp-admin">Admin console</Link>
      </header>

      <main className="lp-main">
        <p className="lp-kicker">Refracting the headlines</p>
        <h1 className="lp-title">One story.<br />Every lens.</h1>
        <p className="lp-sub">The news, fully framed. Bringing stories into focus.</p>
        <div className="lp-beam" aria-hidden />

        <div className="lp-values">
          <section>
            <h2>Every lens</h2>
            <p>Each story is read across outlets from left to right. You get the facts they share and how each side framed the rest.</p>
          </section>
          <section>
            <h2>Press play</h2>
            <p>Every story is a short audio clip. Play one, queue a few, or play a whole section. It keeps playing while you browse.</p>
          </section>
        </div>
      </main>

      <footer className="lp-footer">PRISM News · Refracting the headlines.</footer>
    </div>
  );
}
