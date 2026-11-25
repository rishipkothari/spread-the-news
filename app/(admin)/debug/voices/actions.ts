"use server";

import { redirect } from "next/navigation";
import { config } from "@/lib/config";
import { putJson, putBytes, sizeOf, paths } from "@/lib/storage";
import { audioKey } from "@/pipeline/phase3";
import { VOICE_TEST_PATH, type VoiceTest } from "@/audio/voice-test";
import { impls, type Methods } from "@/stages/registry";

// Behind the password gate in proxy.ts (same as the other /debug pages).


export async function voiceTestAction(fd: FormData) {
  const voice = String(fd.get("voice") ?? config.audio.voice).trim() || config.audio.voice;
  const text = String(fd.get("text") ?? "").trim().slice(0, 3000) || "This is Spread the News, where we read across the spectrum so you don't have to.";
  const tts = impls.tts(config.methods as Methods);
  const result: VoiceTest = { voice, text, provider: tts.id, at: new Date().toISOString() };
  const t0 = Date.now();
  try {
    // Same cache as episodes: a sentence tested here in the episode voice is already voiced for the episode.
    const path = paths.audio(audioKey(text, voice, tts.id, tts.format));
    result.cached = (await sizeOf(path)) != null;
    if (!result.cached) await putBytes(path, await tts.synthesize(text, voice), "audio/mpeg");
    result.audioPath = path;
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
  }
  result.ms = Date.now() - t0;
  await putJson(VOICE_TEST_PATH, result);
  redirect(`/debug/voices?voice=${encodeURIComponent(voice)}&t=${Date.now()}`);
}
