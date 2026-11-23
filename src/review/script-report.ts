import type { CheckResult, EpisodePlan, EpisodeScript, UsageEntry } from "@/lib/types";
import type { ScriptUnit } from "@/pipeline/phase2";
import type { ScriptReview } from "./script-types";

const VOTE = { up: "👍", down: "👎" } as const;

function checkLine(c: CheckResult): string {
  const unsupported = c.claims.filter((x) => x.status !== "supported").length;
  const mustFix = c.issues.filter((i) => i.severity === "must_fix").length;
  const minor = c.issues.filter((i) => i.severity === "minor").length;
  return `${c.pass ? "PASS" : "FAIL"} · ${c.claims.length} claims (${unsupported} not supported) · ${mustFix} must-fix, ${minor} minor`;
}

function issueLines(c: CheckResult, indent = "  "): string[] {
  return [
    ...c.issues.map((i) => `${indent}- [${i.severity} ${i.kind}${i.source === "code" ? ", code" : ""}] "${i.excerpt}": ${i.problem}`),
    ...c.claims.filter((x) => x.status !== "supported").map((x) => `${indent}- [claim ${x.status}] ${x.claim}`),
  ];
}

/** Text summary of a run's Phase 2 output plus the user's feedback, for pasting to Claude. */
export function buildScriptReport(
  runId: string,
  plan: EpisodePlan | null,
  script: EpisodeScript | null,
  units: ScriptUnit[],
  usage: UsageEntry[],
  review: ScriptReview,
): string {
  const lines: string[] = [`# Phase 2 script: run ${runId}`];
  const cost = usage.filter((u) => u.stage === "script").reduce((a, u) => a + (u.costUsd ?? 0), 0);
  if (plan) {
    const cats = plan.params.categories === "all" ? "all" : JSON.stringify(plan.params.categories);
    lines.push(`profile: order ${plan.orderStrategy} · categories ${cats} · target ${Math.round(plan.params.targetDurationSec / 60)} min (${plan.targetWords} words) · planned ${plan.stories.length} stories`);
  }
  if (script) {
    const rewritten = units.filter((u) => u.segment && u.attempts.length > 1).length;
    lines.push(`result: ${script.segments.filter((s) => s.kind === "story").length} stories kept (${rewritten} after a rewrite), ${script.dropped.length} dropped · ${script.words} words ≈ ${script.estMinutes} min · cost $${cost.toFixed(3)}`);
    for (const r of script.policy.reasons) lines.push(`policy note: ${r}`);
    for (const e of script.errors) lines.push(`error: ${e}`);
  }
  if (review.notes.trim()) lines.push("", "## My overall notes", review.notes.trim());

  const byId = new Map(units.map((u) => [u.storyId, u]));
  if (script?.segments.length) {
    lines.push("", "## Script");
    let n = 0;
    for (const seg of script.segments) {
      const fb = review.segments[seg.id];
      const fbText = [fb?.vote ? VOTE[fb.vote] : "", fb?.note?.trim() ? `my note: ${fb.note.trim()}` : ""].filter(Boolean).join(" ");
      if (seg.kind !== "story") {
        lines.push("", `### [${seg.kind}, fixed template]${fbText ? ` ${fbText}` : ""}`, seg.text);
        continue;
      }
      const unit = byId.get(seg.storyId!);
      const p = plan?.stories.find((s) => s.storyId === seg.storyId);
      lines.push("", `### ${++n}. ${unit?.title ?? seg.storyId} (rank ${p?.rank ?? "?"}, ${p?.category ?? "?"}, budget ${p?.wordBudget ?? "?"}, ${seg.words} words${unit && unit.attempts.length > 1 ? ", rewritten" : ""})${fbText ? ` ${fbText}` : ""}`);
      lines.push(seg.text);
      if ("claims" in seg.checkerResult) {
        lines.push(`checker: ${checkLine(seg.checkerResult)}`);
        lines.push(...issueLines(seg.checkerResult));
      }
      if (unit && unit.attempts.length > 1) {
        lines.push("first draft failed:", ...issueLines(unit.attempts[0].check));
      }
    }
  }
  if (script?.dropped.length) {
    lines.push("", "## Dropped by the checker");
    for (const d of script.dropped) {
      lines.push(`- ${d.title}: ${d.reason}`);
      const last = byId.get(d.storyId)?.attempts.at(-1);
      if (last) lines.push(`  last draft: ${last.text}`);
    }
  }
  if (plan?.skipped.length) {
    lines.push("", "## Not planned");
    for (const s of plan.skipped) lines.push(`- ${s.title}: ${s.reason}`);
  }
  return lines.join("\n");
}
