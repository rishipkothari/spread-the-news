import type { CheckIssue, CheckResult, Source } from "@/lib/types";

/**
 * Deterministic checks the runner adds to every checker verdict. Cheap, exact, and they never depend on the LLM noticing.
 */

/**
 * Strings that would name an outlet on air: the full name, plus the name without a leading "The " or a trailing " News"
 * when what remains is still distinctive (two+ words, or an unusual single word like "BBC"/"Breitbart").
 * Single common words ("Hill", "Nation", "Beast") are not used alone: "Capitol Hill" is not an outlet name.
 */
const COMMON_WORDS = new Set(["hill", "nation", "beast", "wire", "caller", "monitor", "news"]);

export function outletAliases(sources: Pick<Source, "name">[]): string[] {
  const out = new Set<string>();
  for (const { name } of sources) {
    out.add(name);
    for (const variant of [name.replace(/^The\s+/, ""), name.replace(/\s+News$/, "")]) {
      if (variant === name) continue;
      const words = variant.split(/\s+/);
      if (words.length >= 2 || !COMMON_WORDS.has(variant.toLowerCase())) out.add(variant);
    }
  }
  return [...out];
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function codeChecks(text: string, sources: Pick<Source, "name">[]): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const alias of outletAliases(sources)) {
    const m = text.match(new RegExp(`(^|[^A-Za-z])(${escape(alias)})(?![A-Za-z])`));
    if (m) issues.push({ kind: "outlet_named", severity: "must_fix", excerpt: m[2], problem: `names an outlet ("${m[2]}"); refer to it by side`, source: "code" });
  }
  const ear: [RegExp, string][] = [
    [/[()[\]]/, "parentheses or brackets don't work when read aloud"],
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
