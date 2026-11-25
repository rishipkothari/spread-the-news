"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const ADMIN_LINKS = [
  { href: "/debug", label: "Overview", icon: "◎", exact: true },
  { href: "/debug/runs", label: "Runs", icon: "▤" },
  { href: "/debug/feeds", label: "Feeds", icon: "≋" },
  { href: "/debug/voices", label: "Voices", icon: "◖" },
  { href: "/player", label: "Episodes", icon: "▶" },
];

export default function AdminNav() {
  const path = usePathname();
  return (
    <nav className="admin-nav" aria-label="Admin">
      {ADMIN_LINKS.map((l) => {
        const on = l.exact ? path === l.href : path === l.href || path.startsWith(`${l.href}/`);
        return (
          <Link key={l.href} href={l.href} className={on ? "on" : undefined} aria-current={on ? "page" : undefined}>
            <span className="ico" aria-hidden>{l.icon}</span>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
