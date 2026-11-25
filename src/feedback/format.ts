/**
 * Feedback to Claude: pure helpers that turn what the user sends from the site into GitHub issue text.
 * Claude reads these issues at the start of each session (see CLAUDE.md, docs/architecture.md "Feedback").
 */

/** Where on the site feedback came from. Each area is a GitHub label `feedback:<area>`; new areas need no setup. */
export const FEEDBACK_AREAS = ["ranking", "analysis", "script", "timing", "player", "pronunciation", "general"] as const;
export type FeedbackArea = (typeof FEEDBACK_AREAS)[number];

export interface FeedbackInput {
  area: FeedbackArea;
  /**
   * Groups sends about the same thing: a second send with the same key while its issue is open becomes a comment
   * on that issue (e.g. `script:{runId}:v2`, `player:{date}`). Omit for a new issue every time.
   */
  key?: string;
  /** Issue title, short. */
  title: string;
  /** The user's own words (may be empty). */
  note?: string;
  /** The generated report (markdown), e.g. the "Copy report for Claude" text. */
  report?: string;
  /** Structured details for Claude (run id, story, time…). Shown in a collapsed JSON block. */
  data?: Record<string, unknown>;
  /** Site path the feedback was sent from. */
  page?: string;
}

/** GitHub caps an issue body or comment at 65,536 characters; stay well under. */
export const MAX_BODY = 60_000;

export const labelsFor = (area: FeedbackArea) => ["feedback", `feedback:${area}`];

/** The issue (or comment) text: note first, then the report, then the data block. */
export function feedbackBody(input: FeedbackInput, sentAt: string): string {
  const head = [
    `**Area:** ${input.area}${input.page ? ` · **Page:** \`${input.page}\`` : ""} · **Sent:** ${sentAt}`,
    input.note?.trim() ? `\n### Note\n\n${input.note.trim()}` : "",
  ].join("\n");
  const report = input.report?.trim() ? `\n### Report\n\n${input.report.trim()}` : "";
  const data = input.data && Object.keys(input.data).length
    ? `\n<details><summary>Data</summary>\n\n\`\`\`json\n${JSON.stringify(input.data, null, 2)}\n\`\`\`\n\n</details>`
    : "";
  return `${head}\n${report}\n${data}\n\n---\n_Sent from the PRISM News site._`.replace(/\n{3,}/g, "\n\n");
}

/** Splits text into pieces of at most `max` characters, at line breaks where possible. */
export function chunkText(text: string, max = MAX_BODY): string[] {
  if (text.length <= max) return [text];
  const out: string[] = [];
  let rest = text;
  while (rest.length > max) {
    let cut = rest.lastIndexOf("\n", max);
    if (cut < max / 2) cut = max;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n/, "");
  }
  if (rest) out.push(rest);
  return out.map((c, i) => (out.length > 1 ? `${c}\n\n_(part ${i + 1} of ${out.length})_` : c));
}

/** Splits a script into sentences (keeps closing quotes with their sentence). */
export function sentences(text: string): string[] {
  return (text.replace(/\s+/g, " ").trim().match(/[^.!?]+(?:[.!?]+["'”’)\]]*|$)\s*/g) ?? []).map((s) => s.trim()).filter(Boolean);
}

/**
 * Estimates which sentence was playing `atSec` into a segment of `durationSec`, assuming an even speaking rate
 * (characters as the proxy). Returns that sentence and one either side; good to about a sentence.
 */
export function locateMoment(text: string, atSec: number, durationSec: number): { index: number; before?: string; sentence: string; after?: string } | null {
  const list = sentences(text);
  if (!list.length) return null;
  const total = list.reduce((n, s) => n + s.length, 0);
  const share = durationSec > 0 ? Math.min(1, Math.max(0, atSec / durationSec)) : 0;
  const target = share * total;
  let acc = 0;
  let index = list.length - 1;
  for (let i = 0; i < list.length; i++) {
    acc += list[i].length;
    if (acc >= target) {
      index = i;
      break;
    }
  }
  return { index, before: list[index - 1], sentence: list[index], after: list[index + 1] };
}

/** 75.4 → "1:15". */
export function clockLabel(sec: number): string {
  const s = Math.max(0, Math.round(sec || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
