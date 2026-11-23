import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EpisodeChapter, EpisodeScript, Segment } from "@/lib/types";
import type { TTSProvider } from "@/stages/types";

// In-memory Blob (JSON and bytes).
const store = new Map<string, unknown>();
vi.mock("@/lib/storage", async (orig) => {
  const real = await orig<typeof import("@/lib/storage")>();
  return {
    ...real,
    putJson: async (p: string, d: unknown) => void store.set(p, structuredClone(d)),
    getJson: async (p: string) => (store.has(p) ? structuredClone(store.get(p)) : null),
    listPaths: async (prefix: string) => [...store.keys()].filter((k) => k.startsWith(prefix)),
    putBytes: async (p: string, d: Uint8Array) => void store.set(p, new Uint8Array(d)),
    getBytes: async (p: string) => (store.get(p) instanceof Uint8Array ? new Uint8Array(store.get(p) as Uint8Array) : null),
    sizeOf: async (p: string) => (store.get(p) instanceof Uint8Array ? (store.get(p) as Uint8Array).length : null),
  };
});

// A counting TTS provider and one that fails for chosen text, registered alongside the real ones.
const calls: string[] = [];
const FAIL_MARK = "[fail]";
vi.mock("@/stages/tts", async (orig) => {
  const real = await orig<typeof import("@/stages/tts")>();
  const { stubTts } = await import("@/stages/tts/stub");
  const counting: TTSProvider = {
    id: "counting",
    format: stubTts.format,
    async synthesize(text, voice) {
      calls.push(`${voice}:${text}`);
      if (text.includes(FAIL_MARK)) throw new Error("service refused");
      return stubTts.synthesize(text, voice);
    },
    voices: stubTts.voices,
  };
  return { ...real, ttsProviders: { ...real.ttsProviders, counting } };
});

const { audioFrames, durationSec, joinMp3, parseHeader, silentMp3 } = await import("@/audio/mp3");
const { splitForTts, escapeXml } = await import("@/audio/text");
const { pickRange, isServableAudioPath } = await import("@/audio/range");
const { chapterAt, nextChapterStart, prevChapterStart } = await import("../app/player/[id]/chapters");
const { formatClock } = await import("@/audio/format");
const phase3 = await import("@/pipeline/phase3");
const { runStage } = await import("@/pipeline/run");
const { paths } = await import("@/lib/storage");
const { config, vanillaParams } = await import("@/lib/config");

const FRAME_SEC = 576 / 24000; // edge-tts format: MPEG-2 Layer III, 24 kHz

describe("mp3 frames", () => {
  it("parses the edge-tts header (24 kHz, 48 kbps, mono, 144-byte frames)", () => {
    const f = parseHeader(Uint8Array.from([0xff, 0xf3, 0x64, 0xc0]), 0)!;
    expect(f).toMatchObject({ version: 2, bitrate: 48000, sampleRate: 24000, samples: 576, mono: true, length: 144 });
  });

  it("parses an MPEG-1 128 kbps 44.1 kHz header", () => {
    const f = parseHeader(Uint8Array.from([0xff, 0xfb, 0x90, 0x64]), 0)!;
    expect(f).toMatchObject({ version: 1, bitrate: 128000, sampleRate: 44100, samples: 1152, length: 417 });
  });

  it("rejects non-headers", () => {
    expect(parseHeader(Uint8Array.from([0xff, 0x00, 0, 0]), 0)).toBeNull();
    expect(parseHeader(Uint8Array.from([0xff, 0xf3, 0xf4, 0xc0]), 0)).toBeNull(); // bad bitrate index
  });

  it("measures duration from frames", () => {
    const mp3 = silentMp3(2);
    const frames = audioFrames(mp3);
    expect(frames.length).toBe(Math.round(2 / FRAME_SEC));
    expect(durationSec(frames)).toBeCloseTo(2, 1);
  });

  it("skips ID3v2, ID3v1, an info frame and junk", () => {
    const audio = silentMp3(1);
    const n = audioFrames(audio).length;
    const id3 = new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 20, ...new Array(20).fill(0)]);
    const info = new Uint8Array(144);
    info.set([0xff, 0xf3, 0x64, 0xc0]);
    info.set([0x49, 0x6e, 0x66, 0x6f], 13); // "Info"
    const tag = new Uint8Array(128);
    tag.set([0x54, 0x41, 0x47]);
    const junk = new Uint8Array([1, 2, 0xff, 3]);
    const all = new Uint8Array([...id3, ...info, ...junk, ...audio, ...tag]);
    expect(audioFrames(all).length).toBe(n);
  });

  it("joins parts with pauses and reports chapter times", () => {
    const a = silentMp3(1), b = silentMp3(2), c = silentMp3(0.5);
    const j = joinMp3([{ mp3: a }, { mp3: b }, { mp3: c }], 0.6);
    const pause = Math.round(0.6 / FRAME_SEC) * FRAME_SEC;
    const d = (x: Uint8Array) => durationSec(audioFrames(x));
    expect(j.parts[0]).toEqual({ startSec: 0, durationSec: d(a) });
    expect(j.parts[1].startSec).toBeCloseTo(d(a) + pause, 5);
    expect(j.parts[2].startSec).toBeCloseTo(d(a) + pause + d(b) + pause, 5);
    expect(j.durationSec).toBeCloseTo(d(a) + d(b) + d(c) + 2 * pause, 5);
    // The joined file is valid frame by frame and as long as reported.
    expect(durationSec(audioFrames(j.mp3))).toBeCloseTo(j.durationSec, 5);
    expect(j.format).toEqual({ sampleRate: 24000, bitrate: 48000, mono: true });
  });

  it("refuses to join different formats", () => {
    const mpeg1 = silentMp3(1, [0xff, 0xfb, 0x90, 0xc4]);
    expect(() => joinMp3([{ mp3: silentMp3(1) }, { mp3: mpeg1 }])).toThrow(/differ in format/);
  });
});

describe("text for TTS", () => {
  it("keeps short text whole and splits long text at sentences", () => {
    expect(splitForTts("  One. Two.  ", 100)).toEqual(["One. Two."]);
    const s = "First sentence here. Second one is here too! Third? Fourth.";
    const parts = splitForTts(s, 25);
    expect(parts.every((p) => p.length <= 25)).toBe(true);
    expect(parts.join(" ")).toBe(s);
  });

  it("splits a very long sentence between words", () => {
    const s = Array.from({ length: 50 }, (_, i) => `word${i}`).join(" ");
    const parts = splitForTts(s, 40);
    expect(parts.every((p) => p.length <= 40)).toBe(true);
    expect(parts.join(" ")).toBe(s);
  });

  it("escapes SSML special characters", () => {
    expect(escapeXml(`AT&T's "deal" <now>`)).toBe("AT&amp;T&apos;s &quot;deal&quot; &lt;now&gt;");
  });
});

describe("range requests", () => {
  it("caps ranges and handles open, suffix and missing headers", () => {
    expect(pickRange(null, 10_000, 4000)).toEqual({ start: 0, end: 3999 });
    expect(pickRange("bytes=0-", 10_000, 4000)).toEqual({ start: 0, end: 3999 });
    expect(pickRange("bytes=0-1", 10_000, 4000)).toEqual({ start: 0, end: 1 }); // Safari's probe
    expect(pickRange("bytes=9000-", 10_000, 4000)).toEqual({ start: 9000, end: 9999 });
    expect(pickRange("bytes=-500", 10_000, 4000)).toEqual({ start: 9500, end: 9999 });
    expect(pickRange("bytes=20000-", 10_000, 4000)).toBeNull();
    expect(pickRange("items=0-1", 10_000, 4000)).toBeNull();
  });

  it("serves only mp3 files from the audio folders", () => {
    expect(isServableAudioPath("audio/abc123.mp3")).toBe(true);
    expect(isServableAudioPath("episodes/2026-11-23-ab12cd34.mp3")).toBe(true);
    expect(isServableAudioPath("runs/x/status.json")).toBe(false);
    expect(isServableAudioPath("audio/../runs/x.mp3")).toBe(false);
    expect(isServableAudioPath("episodes/x.json")).toBe(false);
  });
});

describe("player chapters", () => {
  const ch = (id: string, startSec: number): EpisodeChapter => ({ segmentId: id, kind: "story", title: id, startSec, durationSec: 10 });
  const chapters = [ch("a", 0), ch("b", 20), ch("c", 50)];
  it("finds the current, next and previous chapter", () => {
    expect(chapterAt(chapters, 25)?.segmentId).toBe("b");
    expect(chapterAt(chapters, 19.9)?.segmentId).toBe("a");
    expect(nextChapterStart(chapters, 25)).toBe(50);
    expect(nextChapterStart(chapters, 55)).toBeNull();
    expect(prevChapterStart(chapters, 30)).toBe(20); // >3 s in: restart this chapter
    expect(prevChapterStart(chapters, 21)).toBe(0); // just started: previous chapter
  });
  it("formats clock times", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(781.6)).toBe("13:01");
    expect(formatClock(3725)).toBe("1:02:05");
  });
});

// ---------- voice + assemble runners ----------

const RUN = "2026-11-23T0900-abc123";

function seg(id: string, kind: Segment["kind"], text: string, storyId?: string): Segment {
  return { id, kind, storyId, text, scriptHash: id, words: text.split(" ").length, checkerResult: { pass: true, template: true } };
}

function seed(segments: Segment[]) {
  store.clear();
  calls.length = 0;
  const params = vanillaParams();
  const script: EpisodeScript = { runId: RUN, date: "2026-11-23", params, segments, dropped: [], words: 0, estMinutes: 0, policy: { ok: true, reasons: [] }, errors: [] };
  store.set(paths.stage(RUN, "script"), script);
  store.set(paths.stage(RUN, "plan"), { stories: [{ storyId: "s1", title: "Storm hits the coast" }, { storyId: "s2", title: "Budget vote" }] });
  store.set(paths.status(RUN), {
    runId: RUN, createdAt: "", updatedAt: "", state: "done", params,
    methods: { ...config.methods, tts: "counting" }, stages: { script: { state: "done" } }, errors: [],
  });
}

async function voiceAll() {
  const ids = await phase3.planVoiceUnits(RUN);
  for (const id of ids) await phase3.runVoiceUnit(RUN, id);
  await phase3.mergeVoice(RUN);
}

const SEGMENTS = () => [
  seg("seg-welcome", "welcome", "Welcome to the show."),
  seg("seg-s1", "story", "A storm hit the coast today, and officials ordered evacuations.", "s1"),
  seg("seg-s2", "story", "Lawmakers passed the budget after a long night.", "s2"),
  seg("seg-outro", "outro", "That's the news for today."),
];

describe("voice and assemble stages", () => {
  beforeEach(() => seed(SEGMENTS()));

  it("voices every segment once, then reuses the cache", async () => {
    await voiceAll();
    expect(calls).toHaveLength(4);
    const out = store.get(paths.stage(RUN, "voice")) as import("@/pipeline/phase3").VoiceOut;
    expect(out).toMatchObject({ voiced: 4, cached: 0, failed: 0, provider: "counting", voice: config.audio.voice });

    await voiceAll();
    expect(calls).toHaveLength(4); // nothing re-voiced
    expect((store.get(paths.stage(RUN, "voice")) as { cached: number }).cached).toBe(4);
  });

  it("re-voices only a changed segment", async () => {
    await voiceAll();
    const script = store.get(paths.stage(RUN, "script")) as EpisodeScript;
    script.segments[2] = seg("seg-s2", "story", "Lawmakers passed the budget at dawn.", "s2");
    store.set(paths.stage(RUN, "script"), script);
    await voiceAll();
    expect(calls).toHaveLength(5);
    expect(calls[4]).toContain("at dawn");
  });

  it("assembles the episode with chapters in script order", async () => {
    await voiceAll();
    await runStage(RUN, "assemble");
    const a = store.get(paths.stage(RUN, "assemble")) as import("@/pipeline/phase3").AssembleOut;
    const ep = store.get(paths.episode(a.episodeId)) as import("@/lib/types").Episode;
    expect(a.episodeId).toMatch(/^2026-11-23-[0-9a-f]{8}$/);
    expect(ep.chapters.map((c) => c.title)).toEqual(["Welcome", "Storm hits the coast", "Budget vote", "Sign-off"]);
    expect(ep.chapters[0].startSec).toBe(0);
    for (let i = 1; i < ep.chapters.length; i++) {
      const prev = ep.chapters[i - 1];
      expect(ep.chapters[i].startSec).toBeCloseTo(prev.startSec + prev.durationSec + config.audio.pauseSec, 1);
    }
    const mp3 = store.get(paths.episodeAudio(a.episodeId)) as Uint8Array;
    expect(mp3.length).toBe(ep.bytes);
    expect(durationSec(audioFrames(mp3))).toBeCloseTo(ep.durationSec, 1);
    const status = store.get(paths.status(RUN)) as { stages: Record<string, { state: string; summary?: Record<string, unknown> }> };
    expect(status.stages.assemble.state).toBe("done");
    expect(status.stages.voice.state).toBe("done");
  });

  it("leaves out one story that can't be voiced and lists it", async () => {
    const segs = SEGMENTS();
    segs.splice(3, 0, seg("seg-s3", "story", `Third story ${FAIL_MARK}.`, "s3"));
    seed(segs);
    await voiceAll();
    await runStage(RUN, "assemble");
    const a = store.get(paths.stage(RUN, "assemble")) as import("@/pipeline/phase3").AssembleOut;
    expect(a.missing).toEqual([{ segmentId: "seg-s3", title: "s3", reason: "service refused" }]);
    const ep = store.get(paths.episode(a.episodeId)) as import("@/lib/types").Episode;
    expect(ep.chapters).toHaveLength(4);
  });

  it("fails when a fixed segment or most stories can't be voiced", async () => {
    seed([seg("seg-welcome", "welcome", `Hi ${FAIL_MARK}`), seg("seg-s1", "story", "A story.", "s1")]);
    await expect(voiceAll()).rejects.toThrow(/welcome couldn't be voiced: service refused/);

    seed([seg("seg-s1", "story", `One ${FAIL_MARK}`, "s1"), seg("seg-s2", "story", `Two ${FAIL_MARK}`, "s2"), seg("seg-s3", "story", "Three.", "s3")]);
    await expect(voiceAll()).rejects.toThrow(/2 of 3 stories couldn't be voiced/);
  });

  it("refuses to voice an empty script", async () => {
    seed([]);
    await expect(phase3.planVoiceUnits(RUN)).rejects.toBeInstanceOf(phase3.AudioPolicyError);
  });

  it("keys audio by text, voice, provider and format", () => {
    const k = phase3.audioKey("hello", "v1", "edge-tts", "f");
    expect(phase3.audioKey("hello", "v1", "edge-tts", "f")).toBe(k);
    expect(phase3.audioKey("hello", "v2", "edge-tts", "f")).not.toBe(k);
    expect(phase3.audioKey("hello!", "v1", "edge-tts", "f")).not.toBe(k);
    expect(phase3.audioKey("hello", "v1", "stub", "f")).not.toBe(k);
  });
});
