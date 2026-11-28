import { config } from "@/lib/config";
import { getJson, listRunIds, paths } from "@/lib/storage";
import type { EpisodeScript } from "@/lib/types";
import { impls, type Methods } from "@/stages/registry";
import { VOICE_TEST_PATH, type VoiceTest } from "@/audio/voice-test";
import { voiceTestAction } from "./actions";
import PronunciationTest from "./PronunciationTest";

export const dynamic = "force-dynamic";

/** A story segment from the most recent script, so voices are judged on real copy. */
async function sampleText(): Promise<string | null> {
  for (const id of (await listRunIds()).slice(0, 15)) {
    const script = await getJson<EpisodeScript>(paths.stage(id, "script")).catch(() => null);
    const story = script?.segments.find((s) => s.kind === "story");
    if (story) return story.text;
  }
  return null;
}

export default async function VoicesPage({ searchParams }: { searchParams: Promise<{ voice?: string }> }) {
  const sp = await searchParams;
  const tts = impls.tts(config.methods as Methods);
  const [voices, last, sample] = await Promise.all([tts.voices(), getJson<VoiceTest>(VOICE_TEST_PATH), sampleText()]);
  const selected = sp.voice ?? last?.voice ?? config.audio.voice;
  const text = last?.text ?? sample ?? "This is Prism News, where we read across the spectrum so you don't have to.";
  const list = voices.some((v) => v.id === selected) ? voices : [{ id: selected, label: selected, locale: "" }, ...voices];

  return (
    <main>
      <h1>Voice test</h1>
      <p className="muted">
        Voice provider: <b>{tts.id}</b>. Episode voice now: <b>{config.audio.voice}</b> (set in config). Pick a voice, press Play, and listen. If you hear speech, the voice works from Vercel.
      </p>

      <form action={voiceTestAction} className="story">
        <div className="field">
          <label htmlFor="voice">Voice</label>
          <select id="voice" name="voice" defaultValue={selected}>
            {list.map((v) => (
              <option key={v.id} value={v.id}>{v.label}{v.id === config.audio.voice ? " (episode voice)" : ""}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="text">Text {sample && !last ? <span className="muted">(a story from your latest script)</span> : null}</label>
          <textarea id="text" name="text" rows={8} defaultValue={text} />
        </div>
        <p><button type="submit" className="primary">Voice it</button> <span className="muted">takes a few seconds</span></p>
      </form>

      {last && (
        <div className="story">
          <div className="row">
            <b>Last test:</b> <span className="mono">{last.voice}</span>
            <span className="muted">{new Date(last.at).toLocaleString()}</span>
            {last.ms != null && <span className="muted">{(last.ms / 1000).toFixed(1)}s{last.cached ? " (already voiced)" : ""}</span>}
          </div>
          {last.error ? (
            <p className="bad">It failed: {last.error}</p>
          ) : last.audioPath ? (
            <audio controls preload="metadata" src={`/audio/${last.audioPath}`} style={{ width: "100%", marginTop: 10 }} />
          ) : null}
        </div>
      )}

      <p className="muted">Found {voices.length} voices{voices.length <= 10 ? " (the built-in short list; the full list couldn't be fetched)" : ""}. Tell Claude which voice you like and it becomes the episode voice.</p>

      <PronunciationTest voice={config.audio.voice} provider={tts.id} />
    </main>
  );
}
