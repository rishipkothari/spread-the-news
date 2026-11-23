import Link from "next/link";
import "./globals.css";

export const metadata = { title: "Spread the News" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="nav">
          <Link href="/">Spread the News</Link>
          <Link href="/player">Player</Link>
          <Link href="/debug/runs">Runs</Link>
          <Link href="/debug/feeds">Feeds</Link>
          <Link href="/debug/voices">Voices</Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
