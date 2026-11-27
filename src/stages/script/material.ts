import type { LeanGroup, StorySynthesis } from "@/lib/types";
import type { ScriptInput } from "../types";

/**
 * The story material shown to both the writer and the checker, with stable ids the checker cites:
 * F1… facts, D1… disagreements (D1a, D1b… positions; material ones only), H1… headlines, W1… who's who, FR-left/center/right framing, COV coverage, BG background.
 * Outlets appear by side and by name, so the script can credit them: "left-leaning outlets (HuffPost and The Nation)" (docs/tone-guide.md).
 */

export const SIDE_LABEL: Record<LeanGroup, string> = { left: "left-leaning", center: "centrist", right: "right-leaning" };
const SIDES: LeanGroup[] = ["left", "center", "right"];
const NUM = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const num = (n: number) => NUM[n] ?? String(n);

/** "one right-leaning outlet (Fox News)", "two left-leaning outlets (HuffPost, Vox) and one centrist outlet (NPR)". Without names: sides only. */
export function describeOutlets(sourceIds: string[], sideOf: Record<string, LeanGroup>, nameOf?: Record<string, string>): string {
  const bySide: Record<LeanGroup, string[]> = { left: [], center: [], right: [] };
  for (const id of new Set(sourceIds)) bySide[sideOf[id] ?? "center"].push(nameOf?.[id] ?? "");
  const parts = SIDES.filter((s) => bySide[s].length > 0).map((s) => {
    const n = bySide[s].length;
    const names = bySide[s].filter(Boolean);
    return `${num(n)} ${SIDE_LABEL[s]} outlet${n === 1 ? "" : "s"}${names.length ? ` (${names.join(", ")})` : ""}`;
  });
  return parts.length <= 1 ? (parts[0] ?? "no outlets") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

export function buildMaterial(input: ScriptInput): string {
  return rawMaterial(input);
}

/** Disagreements the script presents: material ones only (minor mismatches stay on the analysis page). Older runs have no level: treat as material. */
export function materialDisputes(s: StorySynthesis): StorySynthesis["disputed"] {
  return s.disputed.filter((d) => d.significance !== "minor");
}

/** id → material line (as the writer saw it), for showing the writer what a flagged claim should have used. */
export function materialEntries(input: ScriptInput): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of buildMaterial(input).split("\n")) {
    const m = line.match(/^\s*(COV|BG|F\d+|D\d+[a-z]?|H\d+|W\d+|FR-(?:left|center|right))\b(.*)$/);
    if (m) out[m[1]] = line.trim();
  }
  return out;
}

function rawMaterial(input: ScriptInput): string {
  const { synthesis: s, sideOf, coverage, nameOf } = input;
  const named = (side: LeanGroup) => (input.coveringNames?.[side].length ? ` (${input.coveringNames[side].join(", ")})` : "");
  const total = coverage.left + coverage.center + coverage.right;
  const lines: string[] = [];
  lines.push(`STORY: ${s.title} (category: ${input.story.category})`);
  lines.push(
    `COV: covered by ${num(total)} outlet${total === 1 ? "" : "s"}: ${SIDES.map((side) => `${coverage[side]} ${SIDE_LABEL[side]}${named(side)}`).join(", ")}.`,
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
      'FACTS FROM ONE OUTLET ONLY (attribute when used, naming the outlet. Give its side too when the side matters: a political claim, a contested point, or something a side has a stake in: "one right-leaning outlet (Fox News) reports…". Otherwise "Fox News reports…". Leave out minor details.):',
    );
    for (const sf of s.singleSourceFacts) lines.push(`F${++f} [${describeOutlets([sf.sourceId], sideOf, nameOf)}]: ${sf.fact}`);
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
      d.positions.forEach((p, j) => lines.push(`  D${i + 1}${String.fromCharCode(97 + j)} [${describeOutlets(p.sourceIds, sideOf, nameOf)}]: ${p.position}`));
    });
    lines.push("");
  }
  if (input.headlines.length) {
    lines.push("HEADLINES (the outlets' own; citable for who people are and basic context, not as extra facts about events):");
    input.headlines.forEach((h, i) => lines.push(`H${i + 1} [${SIDE_LABEL[h.side]}${h.outlet ? `, ${h.outlet}` : ""}]: ${h.text}`));
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
    for (const side of framed) lines.push(`FR-${side} [${SIDE_LABEL[side]} outlets${named(side)}]: ${s.framing[side]}`);
    lines.push("");
  }
  if (input.includeRecently && s.recently) {
    lines.push("BACKGROUND (from earlier days' checked stories; context only, never as an update):");
    lines.push(`BG: ${s.recently}`);
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}
