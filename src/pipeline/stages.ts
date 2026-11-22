/** Phase 0: discovery. Phase 1: full text and story analysis (opt-in, run on a finished run). */
export const STAGES = ["sources", "fetch", "cluster", "rank", "extract", "analyze", "synthesize"] as const;
export type StageId = (typeof STAGES)[number];

/** A plain "start run" stops here; Phase 1 stages are started separately until they're proven. */
export const DEFAULT_THROUGH: StageId = "rank";
export const ANALYSIS_STAGES: StageId[] = ["extract", "analyze", "synthesize"];

/** Stages that fan out as one workflow step per selected story. */
export const FANOUT_STAGES = ["extract", "analyze", "synthesize"] as const;
export type FanoutStage = (typeof FANOUT_STAGES)[number];
export function isFanout(s: StageId): s is FanoutStage {
  return (FANOUT_STAGES as readonly string[]).includes(s);
}

export function isStage(s: string): s is StageId {
  return (STAGES as readonly string[]).includes(s);
}

export function stageRange(from: StageId = STAGES[0], through: StageId = DEFAULT_THROUGH): StageId[] {
  const a = STAGES.indexOf(from);
  const b = STAGES.indexOf(through);
  if (a > b) throw new Error(`stage range is empty: ${from} → ${through}`);
  return STAGES.slice(a, b + 1);
}
