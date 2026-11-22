import Link from "next/link";
import "./globals.css";

export const metadata = { title: "Spread the News" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="nav">
          <Link href="/">Spread the News</Link>
          <Link href="/debug/runs">Runs</Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
