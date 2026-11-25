import Link from "next/link";
import ThemeToggle from "../../_ui/ThemeToggle";

/** Public header: logo and wordmark (to the news), theme switch, a quiet admin link. */
export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-in">
        <Link href="/news" className="brand" aria-label="PRISM News">
          <img src="/brand/glasses-icon.jpg" alt="" width={32} height={32} />
          <span className="brand-word">PRISM</span>
        </Link>
        <nav className="site-nav" aria-label="Site">
          <Link href="/news" className="site-link">News</Link>
          <ThemeToggle className="ib" />
          <Link href="/debug" className="site-admin">Admin</Link>
        </nav>
      </div>
    </header>
  );
}
