import Link from "next/link";
import type { Category } from "@/lib/types";
import { SECTIONS } from "./sections";

/** All news + one chip per section; keeps the chosen date. Scrolls sideways on phones. */
export default function SectionChips({ current, date, counts }: { current: Category | "all"; date?: string; counts?: Partial<Record<Category, number>> }) {
  const q = date ? `?date=${date}` : "";
  const chips = [{ id: "all" as const, label: "All", href: `/news${q}` }, ...SECTIONS.map((s) => ({ id: s.id, label: s.label, href: `/news/${s.id}${q}` }))];
  return (
    <nav className="chips-row" aria-label="Sections">
      <div className="chips-in">
        {chips.map((c) => {
          const n = c.id === "all" ? undefined : counts?.[c.id];
          return (
            <Link key={c.id} href={c.href} className={`chip${current === c.id ? " on" : ""}${n === 0 ? " empty" : ""}`} aria-current={current === c.id ? "page" : undefined}>
              {c.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
