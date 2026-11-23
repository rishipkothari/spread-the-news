import { z } from "zod";

/** The user's feedback on a script: 👍/👎 and a note per segment, plus overall notes. Saved at runs/{id}/script-review.json. */
export const SegmentFeedback = z.object({
  vote: z.enum(["up", "down"]).optional(),
  note: z.string().max(2000).optional(),
});
export type SegmentFeedback = z.infer<typeof SegmentFeedback>;

export const ScriptReview = z.object({
  runId: z.string(),
  savedAt: z.string().optional(),
  notes: z.string().max(4000),
  segments: z.record(z.string(), SegmentFeedback), // keyed by segment id (seg-intro, seg-<storyId>, seg-outro)
});
export type ScriptReview = z.infer<typeof ScriptReview>;

export function emptyScriptReview(runId: string): ScriptReview {
  return { runId, notes: "", segments: {} };
}
