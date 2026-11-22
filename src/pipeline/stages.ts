export const STAGES = ["sources", "fetch", "cluster", "rank"] as const;
export type StageId = (typeof STAGES)[number];

export function isStage(s: string): s is StageId {
  return (STAGES as readonly string[]).includes(s);
}

export function stageRange(from: StageId = STAGES[0], through: StageId = STAGES[STAGES.length - 1]): StageId[] {
  const a = STAGES.indexOf(from);
  const b = STAGES.indexOf(through);
  if (a > b) throw new Error(`stage range is empty: ${from} → ${through}`);
  return STAGES.slice(a, b + 1);
}
