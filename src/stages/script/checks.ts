import type { CheckIssue, CheckResult, LeanGroup, Source } from "@/lib/types";
import { leanGroup } from "@/stages/rank/headline-index-v1";

const SIDE_LABEL: Record<LeanGroup, string> = { left: "left-leaning", center: "centrist", right: "right-leaning" };

/**
 * Deterministic checks the runner adds to every checker verdict. Cheap, exact, and they never depend on the LLM noticing.
 */

/** An outlet's name as said on air: "The Guardian (US)" → "The Guardian", "The Wall Street Journal (News)" → "The Wall Street Journal". */
export function onAirName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

/**
 * The only parentheses the script may use: a list of outlet names after a side ("left-leaning outlets (HuffPost and
 * The Nation)"). Any outlet counts, followed or not ("one report (Bloomberg)"). Each item is a short capitalized name.
 */
const NAME_ITEM = /^(?:[Tt]he\s+)?[A-Z][\w'’.&-]*(?:\s+(?:[A-Z][\w'’.&-]*|of|&))*$/;
export function isOutletList(inner: string): boolean {
  const items = inner.trim().split(/\s*,\s*(?:and\s+)?|\s+and\s+/).filter(Boolean);
  return items.length > 0 && items.length <= 6 && items.every((i) => i.split(/\s+/).length <= 6 && NAME_ITEM.test(i));
}

const SIDE_WORD: Record<string, LeanGroup> = { "left-leaning": "left", centrist: "center", "right-leaning": "right" };

/** Name forms of our own outlets → side: the on-air name, plus without a leading "The". Outlets we don't follow have no side to check. */
function sideByName(sources: Pick<Source, "name" | "leanValue">[]): Map<string, LeanGroup> {
  const out = new Map<string, LeanGroup>();
  for (const s of sources) {
    const n = onAirName(s.name);
    const side = leanGroup(s.leanValue ?? 0);
    out.set(n.toLowerCase(), side);
    out.set(n.replace(/^The\s+/, "").toLowerCase(), side);
  }
  return out;
}

export function codeChecks(text: string, sources: Pick<Source, "name" | "leanValue">[]): CheckIssue[] {
  const issues: CheckIssue[] = [];
  // Naming outlets is fine (docs/decisions.md, 2026-11-27); naming one under the wrong side is not.
  const sides = sideByName(sources);
  for (const m of text.matchAll(/\b(left-leaning|centrist|right-leaning)\s+(?:outlets?|ones?|reports?)\s*\(([^()]+)\)/gi)) {
    const said = SIDE_WORD[m[1].toLowerCase()];
    for (const item of m[2].split(/\s*,\s*(?:and\s+)?|\s+and\s+/).filter(Boolean)) {
      const actual = sides.get(item.trim().toLowerCase()) ?? sides.get(item.trim().replace(/^the\s+/i, "").toLowerCase());
      if (actual && actual !== said) {
        issues.push({ kind: "attribution", severity: "must_fix", excerpt: m[0], problem: `${item.trim()} is a ${SIDE_LABEL[actual]} outlet, not ${SIDE_LABEL[said]}`, source: "code" });
      }
    }
  }
  const paren = [...text.matchAll(/\(([^()]*)\)/g)].find((m) => !isOutletList(m[1]));
  if (paren) issues.push({ kind: "ear", severity: "must_fix", excerpt: paren[0], problem: "parentheses don't work when read aloud (only a list of outlet names may go in parentheses)", source: "code" });
  const ear: [RegExp, string][] = [
    [/[[\]]/, "brackets don't work when read aloud"],
    [/https?:\/\/|www\./i, "web address"],
    [/[#*•]|^\s*-\s/m, "symbol or list formatting"],
  ];
  for (const [re, problem] of ear) {
    const m = text.match(re);
    if (m) issues.push({ kind: "ear", severity: "must_fix", excerpt: m[0], problem, source: "code" });
  }
  const quote = text.match(/["“][^"”]{25,}["”]/);
  if (quote) issues.push({ kind: "ear", severity: "must_fix", excerpt: quote[0].slice(0, 80), problem: "reads a direct quote on air; paraphrase instead", source: "code" });
  return issues;
}

export function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/** Length is advisory: a minor note when a segment is far over budget, never a reason to drop a story. */
export function lengthIssue(text: string, budget: number): CheckIssue | null {
  const n = wordCount(text);
  return n > budget * 1.3 ? { kind: "length", severity: "minor", excerpt: `${n} words`, problem: `about ${budget} words were budgeted`, source: "code" } : null;
}

/** Pass/fail is decided in code: every claim supported and no must_fix issue (from the checker or from code). */
export function verdict(claims: CheckResult["claims"], issues: CheckIssue[]): boolean {
  return claims.every((c) => c.status === "supported") && !issues.some((i) => i.severity === "must_fix");
}
