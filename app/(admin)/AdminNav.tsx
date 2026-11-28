"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { EpisodesIcon, FeedIcon, GridIcon, MicIcon, RunsIcon, WaveIcon } from "../_ui/icons";

export const ADMIN_LINKS = [
  { href: "/debug", label: "Overview", Icon: GridIcon, exact: true },
  { href: "/debug/runs", label: "Runs", Icon: RunsIcon },
  { href: "/debug/feeds", label: "Feeds", Icon: FeedIcon },
  { href: "/debug/voices", label: "Voices", Icon: WaveIcon },
  { href: "/debug/show", label: "Intro", Icon: MicIcon },
  { href: "/player", label: "Episodes", Icon: EpisodesIcon },
];

export default function AdminNav() {
  const path = usePathname();
  return (
    <nav className="admin-nav" aria-label="Admin">
      {ADMIN_LINKS.map(({ href, label, Icon, exact }) => {
        const on = exact ? path === href : path === href || path.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} className={on ? "on" : undefined} aria-current={on ? "page" : undefined}>
            <Icon size={18} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
