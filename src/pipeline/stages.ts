/** Phase 0: discovery (merge = the post-clustering merge check). Phase 1: full text and story analysis. Phase 2: episode plan and script. Phase 3: audio (speak = the spoken text the voice reads). Phases 1–3 are opt-in on a finished run. */
export const STAGES = ["sources", "fetch", "cluster", "merge", "rank", "extract", "analyze", "synthesize", "plan", "script", "speak", "voice", "assemble"] as const;
export type StageId = (typeof STAGES)[number];

/** A plain "start run" stops here; later phases are started separately until they're proven. */
export const DEFAULT_THROUGH: StageId = "rank";
export const ANALYSIS_STAGES: StageId[] = ["extract", "analyze", "synthesize"];
export const SCRIPT_STAGES: StageId[] = ["plan", "script"];
export const AUDIO_STAGES: StageId[] = ["speak", "voice", "assemble"];
export const DISCOVERY_STAGES: StageId[] = ["sources", "fetch", "cluster", "merge", "rank"];

/** Stages that fan out as one workflow step per story (voice: per segment). */
export const FANOUT_STAGES = ["extract", "analyze", "synthesize", "script", "voice"] as const;
export type FanoutStage = (typeof FANOUT_STAGES)[number];
export type Phase1Stage = Exclude<FanoutStage, "script" | "voice">;
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
