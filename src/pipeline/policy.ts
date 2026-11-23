import type { SourceHealth } from "@/lib/types";

export interface PolicyInput {
  sourceHealth: SourceHealth;
  checkedStories: number; // story segments that passed the checker
}

/**
 * Whether an episode may be published. PRD policy: at least config.failurePolicy.minSourcesOk sources returned data
 * and at least config.failurePolicy.minStoriesChecked stories passed the checker.
 *
 * Suspended during MVP (sources and stories are thin): always ok, so whatever passes the checker becomes a script.
 * The would-be failures are still reported as notes so they're visible. To enforce, return ok: notes.length === 0.
 * (Backlog: docs/todo.md → Later → Failure policy.)
 */
export function meetsFailurePolicy(input: PolicyInput, limits: { minSourcesOk: number; minStoriesChecked: number }): { ok: boolean; reasons: string[] } {
  const okSources = Object.values(input.sourceHealth).filter((h) => h.ok).length;
  const notes: string[] = [];
  if (okSources < limits.minSourcesOk) notes.push(`only ${okSources} sources returned data (policy minimum ${limits.minSourcesOk}; not enforced yet)`);
  if (input.checkedStories < limits.minStoriesChecked) notes.push(`only ${input.checkedStories} stories passed the checker (policy minimum ${limits.minStoriesChecked}; not enforced yet)`);
  return { ok: true, reasons: notes };
}
