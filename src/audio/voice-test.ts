/** The last voice test from /debug/voices, kept in Blob so the page can show and play it. */
export interface VoiceTest {
  voice: string;
  text: string;
  provider: string;
  audioPath?: string;
  ms?: number;
  cached?: boolean;
  error?: string;
  at: string;
}

export const VOICE_TEST_PATH = "admin/voice-test.json";
