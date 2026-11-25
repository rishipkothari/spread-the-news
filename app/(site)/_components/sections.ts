import type { Category } from "@/lib/types";

/** Section labels and blurbs for the public pages (plain module: usable from server and client components). */
export const SECTIONS: { id: Category; label: string; blurb: string }[] = [
  { id: "us", label: "US", blurb: "Domestic news, politics, courts and policy." },
  { id: "world", label: "World", blurb: "Stories centered outside the US." },
  { id: "business", label: "Business", blurb: "Markets, companies and the economy." },
  { id: "science", label: "Science", blurb: "Science, health, technology and the environment." },
  { id: "sports", label: "Sports", blurb: "Games, leagues and athletes." },
  { id: "other", label: "Other", blurb: "Culture, entertainment and everything else." },
];

export const sectionLabel = (c: string) => SECTIONS.find((s) => s.id === c)?.label ?? c;
export const isSection = (c: string): c is Category => SECTIONS.some((s) => s.id === c);

/** "2:14" */
export function clock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** "14 min" */
export const minutes = (sec: number) => `${Math.max(1, Math.round(sec / 60))} min`;

/** "Tuesday, November 25" (adds the year when it isn't this year). */
export function longDate(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  const sameYear = d.getUTCFullYear() === new Date().getUTCFullYear();
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", ...(sameYear ? {} : { year: "numeric" }), timeZone: "UTC" });
}

/** "Nov 25" */
export function shortDate(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
