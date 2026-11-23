import { z } from "zod";
import { config } from "@/lib/config";
import { structuredCall } from "@/lib/llm";
import type { CheckIssue, CheckResult } from "@/lib/types";
import type { ScriptChecker, ScriptInput } from "../types";
import { verdict } from "./checks";
import { buildMaterial, materialDisputes } from "./material";
import { TONE_RULES } from "./tone";

export const CHECK_SYSTEM = `You fact-check and tone-check one story segment for Spread the News, a neutral daily news podcast, before it is read aloud. You receive the STORY MATERIAL (the only facts the segment may use, each with an id) and the SEGMENT.

1. Claims. Split the segment into its factual claims: every statement of what happened, who did or said what, numbers, dates, causes, and descriptions of how outlets or sides covered it. For each claim give:
   - claim: the claim in a few words;
   - support: the material ids that support it (F3, D1a, H2, W1, FR-right, COV, BG); empty if none;
   - related: when the claim isn't fully supported, the ids of the material closest to it (what the writer should have used), if any;
   - status: "supported" if the material says it; "distorted" if the material says something related but the segment changes its meaning, certainty, numbers, attribution or who holds a position; "unsupported" if the material doesn't say it at all.
   Plain narration with no factual content ("Here's what happened") is not a claim. Reasonable paraphrase and rounding ("nearly half" for 48%) count as supported. Headlines (H…) and WHO'S WHO lines (W…) support who people are and basic context (a title, a role, what something is), not extra details about events. A single-outlet fact (marked "one … outlet") is supported only if the segment attributes it: by side when the side matters, otherwise "one report says…" is enough.

2. Issues. List every problem a listener or editor would object to, each with kind, severity, excerpt (the exact words from the segment), problem, and fix:
   - "unsupported" / "distorted": restate any such claim from step 1 as a must_fix issue.
   - "outlet_named": the segment names a news outlet. must_fix.
   - "attribution": a single-outlet fact stated as settled, or a position assigned to the wrong side. must_fix.
   - "false_contrast": details from different sides placed side by side as if they conflict when they don't ("The left-leaning outlet says… The right-leaning outlet says…" about unrelated details). must_fix if a listener would hear a left/right dispute that isn't there; otherwise minor.
   - "one_sided_dispute": a disagreement presented as two-sided when the material says all positions come from one outlet or one side. must_fix.
   - "missing_side": a DISAGREEMENT THAT MATTERS is left out, or only one of its positions is given, or the positions get unequal care or a hinted winner. must_fix.
   - "coverage_line": the coverage line invents a difference, judges motives, keeps score, isn't backed by the FR lines, or compares sides when the material says only one side covered the story. must_fix.
   - "tone": breaks the tone guide below: opinion in the narrator's voice, loaded words not attributed, wit at a side's expense or on a tragedy, dated slang, stiff newsreader phrasing, an "update" or "as we told you" framing. must_fix if a listener would hear bias or bad taste; minor for style nits.
   - "ear": hard to follow when heard: parentheses, unexpanded abbreviations, number soup, long direct quotes read aloud. A short attributed phrase of a few words kept to preserve meaning is fine, not an issue. Usually minor; must_fix if it would confuse.
   Don't invent problems. An empty issues list is a good outcome.

The tone guide:
${TONE_RULES}`;

export const CheckOutput = z.object({
  claims: z.array(z.object({ claim: z.string(), support: z.array(z.string()), related: z.array(z.string()).optional(), status: z.enum(["supported", "unsupported", "distorted"]) })),
  issues: z.array(
    z.object({
      kind: z.enum(["unsupported", "distorted", "outlet_named", "attribution", "false_contrast", "one_sided_dispute", "missing_side", "coverage_line", "tone", "ear", "other"]),
      severity: z.enum(["must_fix", "minor"]),
      excerpt: z.string(),
      problem: z.string(),
      fix: z.string().optional(),
    }),
  ),
});
export type CheckOutput = z.infer<typeof CheckOutput>;

export function buildCheckUser(input: ScriptInput, text: string): string {
  return ["STORY MATERIAL:", buildMaterial(input), "", "SEGMENT:", text].join("\n");
}

/** Material ids that exist for this story, so a citation of a made-up id doesn't count as support. */
export function materialIds(input: ScriptInput): Set<string> {
  const s = input.synthesis;
  const ids = new Set<string>(["COV"]);
  const facts = s.agreedFacts.length + (s.singleSourceFacts?.length ?? 0);
  for (let i = 1; i <= facts; i++) ids.add(`F${i}`);
  materialDisputes(s).forEach((d, i) => {
    ids.add(`D${i + 1}`);
    d.positions.forEach((_, j) => ids.add(`D${i + 1}${String.fromCharCode(97 + j)}`));
  });
  for (const side of ["left", "center", "right"] as const) if (s.framing[side]) ids.add(`FR-${side}`);
  input.headlines.forEach((_, i) => ids.add(`H${i + 1}`));
  input.whoIsWho.forEach((_, i) => ids.add(`W${i + 1}`));
  if (input.includeRecently && s.recently) ids.add("BG");
  return ids;
}

/**
 * Turn the checker's output into a verdict. Code decides pass/fail, not the model:
 * fail on any must_fix issue, any claim not "supported", or a "supported" claim citing no real material id.
 */
export function toCheckResult(out: CheckOutput, input: ScriptInput, checker: string): CheckResult {
  const valid = materialIds(input);
  const claims = out.claims.map((c) => {
    const support = c.support.map((x) => x.trim()).filter((x) => valid.has(x));
    const related = (c.related ?? []).map((x) => x.trim()).filter((x) => valid.has(x));
    const status = c.status === "supported" && support.length === 0 ? ("unsupported" as const) : c.status;
    return { claim: c.claim, support, status, ...(related.length ? { related } : {}) };
  });
  const issues: CheckIssue[] = out.issues.map((i) => ({ ...i, source: "checker" as const }));
  return { pass: verdict(claims, issues), claims, issues, checker };
}

export const quoteTraceV1: ScriptChecker = {
  id: "quote-trace-v1",
  async check(input, text) {
    const { data, usage } = await structuredCall({
      model: config.models.check,
      system: CHECK_SYSTEM,
      user: buildCheckUser(input, text),
      schema: CheckOutput,
      maxTokens: config.script.maxTokens,
      effort: config.script.checkEffort as "low" | "medium" | "high",
    });
    return { result: toCheckResult(data, input, "quote-trace-v1"), usage };
  },
};
