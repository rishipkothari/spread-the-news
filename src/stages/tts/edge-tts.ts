import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { joinMp3 } from "@/audio/mp3";
import { escapeXml, splitForTts } from "@/audio/text";
import { config } from "@/lib/config";
import type { TTSProvider, TtsVoice } from "../types";

/**
 * Microsoft Edge's free Read Aloud voices through the `msedge-tts` package (an unofficial endpoint:
 * it can change or block us; the voice test page on /debug/voices is the quick check).
 * Output: 24 kHz 48 kbps mono MP3. Long text is voiced in sentence chunks and the chunks joined.
 */

const FORMAT = OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3;

/** Fallback when the voice list can't be fetched: well-known English neural voices. */
const KNOWN_VOICES: TtsVoice[] = [
  ["en-US-AndrewNeural", "Andrew (US, male)", "Male"],
  ["en-US-AvaNeural", "Ava (US, female)", "Female"],
  ["en-US-BrianNeural", "Brian (US, male)", "Male"],
  ["en-US-EmmaNeural", "Emma (US, female)", "Female"],
  ["en-US-ChristopherNeural", "Christopher (US, male)", "Male"],
  ["en-US-JennyNeural", "Jenny (US, female)", "Female"],
  ["en-US-GuyNeural", "Guy (US, male)", "Male"],
  ["en-US-AriaNeural", "Aria (US, female)", "Female"],
  ["en-GB-RyanNeural", "Ryan (UK, male)", "Male"],
  ["en-GB-SoniaNeural", "Sonia (UK, female)", "Female"],
].map(([id, label, gender]) => ({ id, label, locale: id.slice(0, 5), gender }));

async function collect(stream: NodeJS.ReadableStream): Promise<Uint8Array> {
  const parts: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    stream.on("data", (d: Buffer) => parts.push(Buffer.from(d)));
    stream.on("end", () => resolve());
    stream.on("close", () => resolve());
    stream.on("error", reject);
  });
  return new Uint8Array(Buffer.concat(parts));
}

async function withRetries<T>(what: string, fn: () => Promise<T>): Promise<T> {
  const tries = Math.max(1, config.audio.retries + 1);
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (i < tries - 1) await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
  throw new Error(`edge-tts ${what} failed after ${tries} tries: ${last instanceof Error ? last.message : String(last)}`);
}

/** `text` is already SSML-safe: escaped plain text, or a markup fragment for the pronunciation test. */
async function voiceChunk(text: string, voice: string): Promise<Uint8Array> {
  const tts = new MsEdgeTTS({ connectionTimeoutMs: 15_000, synthesisTimeoutMs: 60_000 });
  try {
    await tts.setMetadata(voice, FORMAT);
    const { audioStream } = tts.toStream(text);
    const mp3 = await collect(audioStream);
    if (mp3.length < 500) throw new Error(`no audio returned (${mp3.length} bytes); the voice name may be wrong or the service refused the request`);
    return mp3;
  } finally {
    tts.close();
  }
}

export const edgeTts: TTSProvider = {
  id: "edge-tts",
  format: "mp3-24k-48k-mono",

  async synthesize(text, voice) {
    const chunks = splitForTts(text, config.audio.maxChunkChars);
    if (!chunks.length) throw new Error("nothing to voice (empty text)");
    const parts: Uint8Array[] = [];
    for (const [i, chunk] of chunks.entries()) parts.push(await withRetries(`chunk ${i + 1}/${chunks.length}`, () => voiceChunk(escapeXml(chunk), voice)));
    return parts.length === 1 ? parts[0] : joinMp3(parts.map((mp3) => ({ mp3 }))).mp3;
  },

  async synthesizeMarkup(fragment, voice) {
    // One try only: if the service refuses a tag, that refusal is the test result.
    return voiceChunk(fragment, voice);
  },

  async voices() {
    try {
      const all = await new MsEdgeTTS().getVoices();
      const en = all
        .filter((v) => v.Locale.startsWith("en-"))
        .map((v) => ({ id: v.ShortName, label: `${v.ShortName.split("-")[2]?.replace(/Neural$/, "")} (${v.Locale}, ${v.Gender.toLowerCase()})`, locale: v.Locale, gender: v.Gender }));
      return en.length ? en.sort((a, b) => a.locale.localeCompare(b.locale) || a.id.localeCompare(b.id)) : KNOWN_VOICES;
    } catch {
      return KNOWN_VOICES;
    }
  },
};
