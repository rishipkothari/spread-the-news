import { silentMp3 } from "@/audio/mp3";
import type { TTSProvider } from "../types";

/** Silence at about 150 words a minute, in edge-tts's format. For tests and dry runs; costs nothing and needs no network. */
export const stubTts: TTSProvider = {
  id: "stub",
  format: "mp3-24k-48k-mono",
  async synthesize(text) {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    if (!words) throw new Error("nothing to voice (empty text)");
    return silentMp3(Math.max(0.5, (words / 150) * 60));
  },
  async voices() {
    return [{ id: "stub-voice", label: "Stub (silence)", locale: "en-US" }];
  },
};
