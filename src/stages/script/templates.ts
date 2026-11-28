import { config } from "@/lib/config";
import type { TemplateKind } from "@/lib/types";

/**
 * Fixed segments (no LLM), each switchable: welcome (generic show intro), rundown (today's stories), outro.
 * Which ones play: config/pipeline.json → script.templates. Wording: edited on /debug/show (src/show/store.ts), with
 * config script.welcome / rundown / outro as the default.
 * To be replaced per profile once episodes are customizable.
 */
export const TEMPLATE_KINDS: TemplateKind[] = ["welcome", "rundown", "outro"];

export function listTitles(titles: string[]): string {
  const t = titles.map((x) => x.replace(/[.!?]+$/, ""));
  if (t.length <= 1) return t[0] ?? "";
  if (t.length === 2) return `${t[0]}, and ${t[1]}`;
  return `${t.slice(0, -1).join("; ")}; and ${t.at(-1)}`;
}

/** The rundown names only the top few stories (config script.rundownTop), then "and more", so it stays short when read aloud. */
export function rundownList(titles: string[], top: number = config.script.rundownTop): string {
  if (titles.length <= top) return listTitles(titles);
  const t = titles.slice(0, top).map((x) => x.replace(/[.!?]+$/, ""));
  return `${t.join("; ")}; and more`;
}

export type TemplateTexts = Partial<Record<TemplateKind, string>>;

export function templateText(kind: TemplateKind, titles: string[], texts: TemplateTexts = {}): string {
  const text = texts[kind] ?? config.script[kind] ?? "";
  return kind === "rundown" ? text.replace("{stories}", rundownList(titles)) : text;
}

/** Enabled template kinds in config order, split around the stories. */
export function enabledTemplates(enabled: string[] = config.script.templates, texts: TemplateTexts = {}): { before: TemplateKind[]; after: TemplateKind[] } {
  const on = TEMPLATE_KINDS.filter((k) => enabled.includes(k) && (texts[k] ?? config.script[k])?.trim());
  return { before: on.filter((k) => k !== "outro"), after: on.filter((k) => k === "outro") };
}
