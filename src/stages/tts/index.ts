import type { TTSProvider } from "../types";
import { edgeTts } from "./edge-tts";
import { stubTts } from "./stub";

export const ttsProviders: Record<string, TTSProvider> = { [edgeTts.id]: edgeTts, [stubTts.id]: stubTts };
