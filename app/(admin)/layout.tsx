import Link from "next/link";
import ThemeToggle from "../_ui/ThemeToggle";
import AdminNav from "./AdminNav";

export const metadata = { title: "Admin · PRISM News" };

/** Admin console frame (sidebar on desktop, tab strip on phones) around /debug/* and /player/*. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin">
      <aside className="admin-side">
        <div className="admin-top">
          <Link href="/" className="admin-brand" aria-label="PRISM News home">
            <img src="/brand/glasses-icon.jpg" alt="" width={30} height={30} />
            <span className="wordmark">PRISM</span>
            <span className="admin-tag">Admin</span>
          </Link>
          <Link href="/news" className="admin-news">News</Link>
        </div>
        <AdminNav />
        <div className="admin-foot">
          <ThemeToggle className="admin-theme" withLabel />
        </div>
      </aside>
      <div className="admin-content">{children}</div>
    </div>
  );
}
