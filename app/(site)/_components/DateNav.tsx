"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { CalendarIcon, ChevronLeft, ChevronRight } from "../../_ui/icons";
import { longDate } from "./sections";

/** ‹ Tuesday, November 25 ›. Arrows go to the nearest days with news; the date opens a calendar. */
export default function DateNav({ basePath, date, older, newer, latest }: { basePath: string; date: string; older?: string | null; newer?: string | null; latest?: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const href = (d: string) => (d === latest ? basePath : `${basePath}?date=${d}`);
  const today = new Date().toISOString().slice(0, 10);

  const openPicker = () => {
    const el = input.current;
    if (!el) return;
    try { el.showPicker(); } catch { el.focus(); el.click(); }
  };

  return (
    <div className="datenav">
      {older ? (
        <Link href={href(older)} className="ib" aria-label={`Previous day: ${longDate(older)}`}><ChevronLeft size={20} /></Link>
      ) : (
        <span className="ib disabled" aria-hidden><ChevronLeft size={20} /></span>
      )}
      <button type="button" className="datenav-date" onClick={openPicker}>
        <CalendarIcon size={16} />
        <span>{longDate(date)}</span>
      </button>
      <input
        ref={input}
        type="date"
        className="datenav-input"
        value={date}
        max={today}
        tabIndex={-1}
        aria-hidden
        onChange={(e) => e.target.value && router.push(href(e.target.value))}
      />
      {newer ? (
        <Link href={href(newer)} className="ib" aria-label={`Next day: ${longDate(newer)}`}><ChevronRight size={20} /></Link>
      ) : (
        <span className="ib disabled" aria-hidden><ChevronRight size={20} /></span>
      )}
    </div>
  );
}
