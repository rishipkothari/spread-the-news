/**
 * Minimal MP3 (MPEG audio Layer III) frame handling: enough to join segments voiced in one format,
 * add silent pauses and measure duration without an encoder. All segments must share sample rate
 * and channel mode (one voice, one output format), which the TTS stage guarantees.
 */

export interface FrameInfo {
  offset: number;
  length: number;
  version: 1 | 2 | 25; // MPEG-1, MPEG-2, MPEG-2.5
  bitrate: number; // bits per second
  sampleRate: number;
  samples: number; // samples per frame
  mono: boolean;
}

const BITRATES_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const BITRATES_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const SAMPLE_RATES: Record<number, number[]> = { 1: [44100, 48000, 32000], 2: [22050, 24000, 16000], 25: [11025, 12000, 8000] };

/** Parse a Layer III frame header at `offset`, or null if there isn't a valid one. */
export function parseHeader(buf: Uint8Array, offset: number): FrameInfo | null {
  if (offset + 4 > buf.length) return null;
  const b1 = buf[offset + 1], b2 = buf[offset + 2], b3 = buf[offset + 3];
  if (buf[offset] !== 0xff || (b1 & 0xe0) !== 0xe0) return null;
  const versionBits = (b1 >> 3) & 0b11;
  const layerBits = (b1 >> 1) & 0b11;
  if (versionBits === 0b01 || layerBits !== 0b01) return null; // reserved version; Layer III only
  const version = versionBits === 0b11 ? 1 : versionBits === 0b10 ? 2 : 25;
  const bitrateIdx = b2 >> 4;
  const srIdx = (b2 >> 2) & 0b11;
  if (bitrateIdx === 0 || bitrateIdx === 15 || srIdx === 3) return null; // free-format, bad, reserved
  const bitrate = (version === 1 ? BITRATES_V1_L3 : BITRATES_V2_L3)[bitrateIdx] * 1000;
  const sampleRate = SAMPLE_RATES[version][srIdx];
  const padding = (b2 >> 1) & 1;
  const samples = version === 1 ? 1152 : 576;
  const length = Math.floor(((samples / 8) * bitrate) / sampleRate) + padding;
  return { offset, length, version, bitrate, sampleRate, samples, mono: (b3 >> 6) === 0b11 };
}

/** Bytes to skip at the start for an ID3v2 tag (0 if none). */
function id3v2Size(buf: Uint8Array): number {
  if (buf.length < 10 || buf[0] !== 0x49 || buf[1] !== 0x44 || buf[2] !== 0x33) return 0; // "ID3"
  const size = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
  const footer = buf[5] & 0x10 ? 10 : 0;
  return 10 + size + footer;
}

/** A Xing/Info/VBRI header frame carries no audio; joined files must not keep it (it states the wrong length). */
function isInfoFrame(buf: Uint8Array, f: FrameInfo): boolean {
  const end = Math.min(f.offset + f.length, buf.length);
  for (let i = f.offset + 4; i + 4 <= end && i < f.offset + 40; i++) {
    const tag = String.fromCharCode(buf[i], buf[i + 1], buf[i + 2], buf[i + 3]);
    if (tag === "Xing" || tag === "Info" || tag === "VBRI") return true;
  }
  return false;
}

/**
 * Every audio frame in `buf`, skipping ID3v2/ID3v1 tags, an info frame and any junk between frames.
 * A frame counts only if the next frame (or the end of the data) follows it, so stray 0xFF bytes aren't mistaken for headers.
 */
export function audioFrames(buf: Uint8Array): FrameInfo[] {
  const frames: FrameInfo[] = [];
  let end = buf.length;
  if (end >= 128 && buf[end - 128] === 0x54 && buf[end - 127] === 0x41 && buf[end - 126] === 0x47) end -= 128; // "TAG"
  let i = id3v2Size(buf);
  while (i + 4 <= end) {
    const f = parseHeader(buf, i);
    if (f && f.length > 4 && i + f.length <= end) {
      const next = i + f.length;
      if (next === end || next + 4 > end || parseHeader(buf, next)) {
        frames.push(f);
        i = next;
        continue;
      }
    }
    i++;
  }
  if (frames.length && isInfoFrame(buf, frames[0])) frames.shift();
  return frames;
}

export function durationSec(frames: FrameInfo[]): number {
  return frames.reduce((a, f) => a + f.samples / f.sampleRate, 0);
}

/**
 * A silent frame in the same format as `like`: same header (padding off), zeroed side info and data.
 * Zero side info = no Huffman data = silence, and main_data_begin = 0 so it doesn't borrow from earlier frames.
 */
export function silentFrame(buf: Uint8Array, like: FrameInfo): Uint8Array {
  const header = buf.slice(like.offset, like.offset + 4);
  header[2] &= ~0b10; // no padding
  const f = parseHeader(header, 0)!;
  const out = new Uint8Array(f.length);
  out.set(header);
  if (!(header[1] & 1)) out.set([0, 0], 4); // CRC present: leave a zero CRC (decoders that check it treat the frame as silence anyway)
  return out;
}

export interface Part {
  mp3: Uint8Array;
}

export interface Joined {
  mp3: Uint8Array;
  durationSec: number;
  /** Start time and duration of each input part in the joined audio, in input order. */
  parts: { startSec: number; durationSec: number }[];
  format: { sampleRate: number; bitrate: number; mono: boolean };
}

/** Join MP3s frame by frame (tags and info frames dropped), with `pauseSec` of silence between parts. */
export function joinMp3(parts: Part[], pauseSec = 0): Joined {
  const parsed = parts.map((p) => ({ buf: p.mp3, frames: audioFrames(p.mp3) }));
  const first = parsed.find((p) => p.frames.length);
  if (!first) throw new Error("no MP3 audio frames in any part");
  const f0 = first.frames[0];
  for (const p of parsed) {
    const bad = p.frames.find((f) => f.sampleRate !== f0.sampleRate || f.mono !== f0.mono);
    if (bad) throw new Error(`MP3 parts differ in format (${bad.sampleRate} Hz vs ${f0.sampleRate} Hz); voice every segment with the same output format`);
  }
  const silence = silentFrame(first.buf, f0);
  const silenceFrameSec = f0.samples / f0.sampleRate;
  const pauseFrames = pauseSec > 0 ? Math.round(pauseSec / silenceFrameSec) : 0;

  const chunks: Uint8Array[] = [];
  const out: Joined["parts"] = [];
  let t = 0;
  parsed.forEach((p, idx) => {
    if (idx > 0 && pauseFrames) {
      for (let k = 0; k < pauseFrames; k++) chunks.push(silence);
      t += pauseFrames * silenceFrameSec;
    }
    for (const f of p.frames) chunks.push(p.buf.subarray(f.offset, f.offset + f.length));
    const d = durationSec(p.frames);
    out.push({ startSec: t, durationSec: d });
    t += d;
  });
  const total = chunks.reduce((a, c) => a + c.length, 0);
  const mp3 = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    mp3.set(c, o);
    o += c.length;
  }
  return { mp3, durationSec: t, parts: out, format: { sampleRate: f0.sampleRate, bitrate: f0.bitrate, mono: f0.mono } };
}

/** `n` silent frames in a given format; used by the stub TTS provider and tests. Default: 24 kHz 48 kbps mono (edge-tts's format). */
export function silentMp3(seconds: number, header: [number, number, number, number] = [0xff, 0xf3, 0x64, 0xc0]): Uint8Array {
  const h = Uint8Array.from(header);
  const f = parseHeader(h, 0);
  if (!f) throw new Error("invalid MP3 header");
  const frame = silentFrame(h, f);
  const n = Math.max(1, Math.round(seconds / (f.samples / f.sampleRate)));
  const out = new Uint8Array(n * frame.length);
  for (let k = 0; k < n; k++) out.set(frame, k * frame.length);
  return out;
}
