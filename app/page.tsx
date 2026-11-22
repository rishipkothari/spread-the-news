import Link from "next/link";

export default function Home() {
  return (
    <main>
      <h1>Spread the News</h1>
      <p className="muted">Phase 0: story discovery. The player arrives in Phase 3.</p>
      <p><Link href="/debug/runs">Debug: recent runs →</Link></p>
    </main>
  );
}
