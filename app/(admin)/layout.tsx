import Link from "next/link";
import AdminNav from "./AdminNav";

export const metadata = { title: "Admin · PRISM News" };

/** Admin console frame (sidebar on desktop, tab strip on phones) around /debug/* and /player/*. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin">
      <aside className="admin-side">
        <Link href="/debug" className="admin-brand">
          <span className="wordmark">PRISM</span>
          <span className="admin-tag">Admin</span>
        </Link>
        <AdminNav />
        <Link href="/" className="admin-back">← Back to site</Link>
      </aside>
      <div className="admin-content">{children}</div>
    </div>
  );
}
