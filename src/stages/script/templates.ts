import { config } from "@/lib/config";

/**
 * Fixed intro and outro (no LLM). Wording lives in config/pipeline.json → script.intro / script.outro;
 * {stories} becomes the episode's story titles. To be replaced per profile once episodes are customizable.
 */
export function listTitles(titles: string[]): string {
  const t = titles.map((x) => x.replace(/[.!?]+$/, ""));
  if (t.length <= 1) return t[0] ?? "";
  if (t.length === 2) return `${t[0]}, and ${t[1]}`;
  return `${t.slice(0, -1).join("; ")}; and ${t.at(-1)}`;
}

export function introText(titles: string[]): string {
  return config.script.intro.replace("{stories}", listTitles(titles));
}

export function outroText(): string {
  return config.script.outro;
}
