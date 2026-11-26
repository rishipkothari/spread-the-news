import type { SpeakOut } from "@/pipeline/speak";
import type { EpisodeScript } from "@/lib/types";

/** "What the voice reads differently": the speak stage's edits per segment (docs/pronunciation.md). Server-rendered. */
export default function SpokenChanges({ spoken, script, titles }: { spoken: SpeakOut | null; script: EpisodeScript | null; titles: Map<string, string> }) {
  const current = new Map((script?.segments ?? []).map((s) => [s.id, s.text]));
  // Only segments whose text still matches this script (a re-written script needs "Make audio" again).
  const segs = (spoken?.segments ?? []).filter((s) => current.get(s.segmentId) === s.text && (s.edits.length || s.rejected.length));
  const label = (kind: string, storyId?: string) =>
    kind === "story" ? titles.get(storyId ?? "") ?? storyId ?? "Story" : kind === "welcome" ? "Welcome" : kind === "rundown" ? "Today's rundown" : kind === "outro" ? "Sign-off" : kind;
  return (
    <section id="spoken">
      <h2>What the voice reads differently</h2>
      {!spoken ? (
        <p className="muted">Made when you press &quot;Make audio&quot;. The site keeps showing the text above; the voice reads a copy with only the words it would say wrong changed.</p>
      ) : !segs.length ? (
        <p className="muted">No changes for this script{spoken.method === "none" ? " (spoken pass switched off)" : ""}.</p>
      ) : (
        <>
          <p className="muted" style={{ fontSize: 13 }}>
            Rules = fixed in code; Claude = judged from context. Listen for these when you play the episode, and flag any that sound worse.
          </p>
          {segs.map((s) => (
            <div className="story" key={s.segmentId}>
              <div className="title">{label(s.kind, s.storyId)}</div>
              <table style={{ fontSize: 13, width: "100%" }}>
                <tbody>
                  {s.edits.map((e, i) => (
                    <tr key={i}>
                      <td className="mono">{e.find}</td>
                      <td>→</td>
                      <td className="mono"><b>{e.replace}</b></td>
                      <td className="muted">{e.by === "rule" ? "rule" : "Claude"} · {e.why}</td>
                    </tr>
                  ))}
                  {s.rejected.map((e, i) => (
                    <tr key={`r${i}`} className="muted">
                      <td className="mono"><s>{e.find}</s></td>
                      <td>→</td>
                      <td className="mono"><s>{e.replace}</s></td>
                      <td className="warn">refused: {e.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}
      {spoken?.warnings.map((w) => <p key={w} className="warn" style={{ fontSize: 13 }}>{w}</p>)}
    </section>
  );
}
