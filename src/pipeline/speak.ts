import type { SpokenSegment } from "@/audio/spoken";
import { getJson, paths, putJson } from "@/lib/storage";
import type { EpisodeScript } from "@/lib/types";
import { impls, type Methods } from "@/stages/registry";
import { config } from "@/lib/config";

/** runs/{id}/speak.json: per segment, the display text, the spoken text and every edit (plus refused ones). */
export interface SpeakOut {
  method: string;
  createdAt: string;
  segments: SpokenSegment[];
  warnings: string[];
}

export async function readSpoken(runId: string): Promise<SpeakOut | null> {
  return getJson<SpeakOut>(paths.stage(runId, "speak"));
}

/** The "speak" stage: first in "Make audio", so it also works on scripts written before it existed. */
export async function speakScript(runId: string, m: Methods) {
  const script = await getJson<EpisodeScript>(paths.stage(runId, "script"));
  if (!script) throw new Error(`run ${runId} has no script; write the script first`);
  const speaker = impls.speak({ ...config.methods, ...m } as Methods);
  const r = await speaker.speak({ segments: script.segments.map((s) => ({ id: s.id, kind: s.kind, storyId: s.storyId, text: s.text })) });
  const out: SpeakOut = { method: speaker.id, createdAt: new Date().toISOString(), segments: r.segments, warnings: r.warnings };
  await putJson(paths.stage(runId, "speak"), out);
  const edits = r.segments.reduce((a, s) => a + s.edits.length, 0);
  const byClaude = r.segments.reduce((a, s) => a + s.edits.filter((e) => e.by === "claude").length, 0);
  const refused = r.segments.reduce((a, s) => a + s.rejected.length, 0);
  return {
    summary: { method: speaker.id, changes: edits, byClaude, refused, ...(r.warnings.length ? { warnings: r.warnings.length } : {}) },
    usage: r.usage,
  };
}
