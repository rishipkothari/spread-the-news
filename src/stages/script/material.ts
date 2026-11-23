import type { LeanGroup, StorySynthesis } from "@/lib/types";
import type { ScriptInput } from "../types";
import { outletAliases } from "./checks";

/**
 * The story material shown to both the writer and the checker, with stable ids the checker cites:
 * F1… facts, D1… disagreements (D1a, D1b… positions; material ones only), H1… headlines, W1… who's who, FR-left/center/right framing, COV coverage, BG background.
 * Outlets appear only by side: the script must never name one (docs/tone-guide.md).
 */

export const SIDE_LABEL: Record<LeanGroup, string> = { left: "left-leaning", center: "centrist", right: "right-leaning" };
const SIDES: LeanGroup[] = ["left", "center", "right"];
const NUM = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const num = (n: number) => NUM[n] ?? String(n);

/** "one right-leaning outlet", "two left-leaning outlets and one centrist outlet". */
export function describeOutlets(sourceIds: string[], sideOf: Record<string, LeanGroup>): string {
  const counts: Record<LeanGroup, number> = { left: 0, center: 0, right: 0 };
  for (const id of new Set(sourceIds)) counts[sideOf[id] ?? "center"]++;
  const parts = SIDES.filter((s) => counts[s] > 0).map((s) => `${num(counts[s])} ${SIDE_LABEL[s]} outlet${counts[s] === 1 ? "" : "s"}`);
  return parts.length <= 1 ? (parts[0] ?? "no outlets") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

const escape = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Phase 1 text sometimes names outlets ("Mother Jones frames…", "with the Hill adding…"). Replace each name (the same
 * aliases the code check looks for, any leading "the", any possessive) by its side, so the writer never sees a name to repeat.
 */
export function scrubOutlets(text: string, outlets: ScriptInput["outlets"]): string {
  const forms = outlets.flatMap((o) => outletAliases([o]).map((f) => ({ f, side: o.side })));
  forms.sort((a, b) => b.f.length - a.f.length); // longest first: "Fox News" before "Fox"
  let out = text;
  for (const { f, side } of forms) {
    const body = f.startsWith("The ") ? `[Tt]he\\s+${escape(f.slice(4))}` : `(?:\\b[Tt]he\\s+)?${escape(f)}`;
    const re = new RegExp(`(?<![A-Za-z])${body}(?![A-Za-z])('s)?`, "g");
    out = out.replace(re, (_m, poss?: string) => `a ${SIDE_LABEL[side]} outlet${poss ? "'s" : ""}`);
  }
  return out.replace(/(^|[.!?:]\s+)a (left|centrist|right)/gm, (_m, pre: string, w: string) => `${pre}A ${w}`);
}

export function buildMaterial(input: ScriptInput): string {
  return scrubOutlets(rawMaterial(input), input.outlets);
}

/** Disagreements the script presents: material ones only (minor mismatches stay on the analysis page). Older runs have no level: treat as material. */
export function materialDisputes(s: StorySynthesis): StorySynthesis["disputed"] {
  return s.disputed.filter((d) => d.significance !== "minor");
}

/** id → material line (as the writer saw it, names scrubbed), for showing the writer what a flagged claim should have used. */
export function materialEntries(input: ScriptInput): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of buildMaterial(input).split("\n")) {
    const m = line.match(/^\s*(COV|BG|F\d+|D\d+[a-z]?|H\d+|W\d+|FR-(?:left|center|right))\b(.*)$/);
    if (m) out[m[1]] = line.trim();
  }
  return out;
}

function rawMaterial(input: ScriptInput): string {
  const { synthesis: s, sideOf, coverage } = input;
  const total = coverage.left + coverage.center + coverage.right;
  const lines: string[] = [];
  lines.push(`STORY: ${s.title} (category: ${input.story.category})`);
  lines.push(
    `COV: covered by ${num(total)} outlet${total === 1 ? "" : "s"}: ${SIDES.map((side) => `${coverage[side]} ${SIDE_LABEL[side]}`).join(", ")}.`,
  );
  lines.push("");

  let f = 0;
  if (s.agreedFacts.length) {
    lines.push("FACTS REPORTED BY TWO OR MORE OUTLETS (state plainly):");
    for (const af of s.agreedFacts) lines.push(`F${++f}: ${af.fact}`);
    lines.push("");
  }
  if (s.singleSourceFacts?.length) {
    lines.push(
      'FACTS FROM ONE OUTLET ONLY (attribute when used. Name the side only if it matters: a political claim, a contested point, or something a side has a stake in: "one right-leaning outlet reports…". Otherwise "one report says…". Leave out minor details.):',
    );
    for (const sf of s.singleSourceFacts) lines.push(`F${++f} [${describeOutlets([sf.sourceId], sideOf)}]: ${sf.fact}`);
    lines.push("");
  }
  const disputes = materialDisputes(s);
  if (disputes.length) {
    lines.push("DISAGREEMENTS THAT MATTER (present each one, saying who holds each position):");
    disputes.forEach((d, i) => {
      const all = new Set(d.positions.flatMap((p) => p.sourceIds));
      const sides = new Set([...all].map((id) => sideOf[id] ?? "center"));
      const note = all.size <= 1 ? " (every position comes from the same single outlet: not a two-sided debate)" : sides.size === 1 ? ` (all positions from ${SIDE_LABEL[[...sides][0]]} outlets)` : "";
      lines.push(`D${i + 1}: ${d.claim}${note}`);
      d.positions.forEach((p, j) => lines.push(`  D${i + 1}${String.fromCharCode(97 + j)} [${describeOutlets(p.sourceIds, sideOf)}]: ${p.position}`));
    });
    lines.push("");
  }
  if (input.headlines.length) {
    lines.push("HEADLINES (the outlets' own; citable for who people are and basic context, not as extra facts about events):");
    input.headlines.forEach((h, i) => lines.push(`H${i + 1} [${SIDE_LABEL[h.side]}]: ${h.text}`));
    lines.push("");
  }
  if (input.whoIsWho.length) {
    lines.push("WHO'S WHO (roles stated in other stories' checked material today; cite only for who someone is):");
    input.whoIsWho.forEach((w, i) => lines.push(`W${i + 1}: ${w}`));
    lines.push("");
  }
  const coveringSides = SIDES.filter((side) => coverage[side] > 0);
  if (coveringSides.length === 1) {
    lines.push(
      `COVERAGE NOTE: only ${SIDE_LABEL[coveringSides[0]]} outlets covered this story. Don't compare sides; instead say so plainly in one sentence (e.g. "This one was covered mostly by ${SIDE_LABEL[coveringSides[0]]} outlets").`,
      "",
    );
  }
  const framed = SIDES.filter((side) => s.framing[side]);
  if (framed.length) {
    lines.push(
      coveringSides.length === 1
        ? "FRAMING (one side only: context for emphasis, not for a coverage-difference line):"
        : "FRAMING BY SIDE (source for the optional coverage line; describe emphasis, never motives):",
    );
    for (const side of framed) lines.push(`FR-${side} [${SIDE_LABEL[side]} outlets]: ${s.framing[side]}`);
    lines.push("");
  }
  if (input.includeRecently && s.recently) {
    lines.push("BACKGROUND (from earlier days' checked stories; context only, never as an update):");
    lines.push(`BG: ${s.recently}`);
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}
