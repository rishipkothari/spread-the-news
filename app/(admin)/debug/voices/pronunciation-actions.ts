"use server";

import { config } from "@/lib/config";
import { paths, putBytes, sizeOf } from "@/lib/storage";
import { audioKey } from "@/pipeline/phase3";
import { PRONUNCIATION_TEST } from "@/audio/pronunciation-test";
import { impls, type Methods } from "@/stages/registry";

// Behind the password gate in proxy.ts (same as the other /debug pages).

export type ClipResult = { ok: true; src: string; cached: boolean } | { ok: false; error: string };

/** Voices one version of one test line in the episode voice (cached in audio/ like episode segments). */
export async function voiceClipAction(itemId: string, variantId: string): Promise<ClipResult> {
  const variant = PRONUNCIATION_TEST.find((i) => i.id === itemId)?.variants.find((x) => x.id === variantId);
  if (!variant) return { ok: false, error: "unknown test line" };
  const tts = impls.tts(config.methods as Methods);
  const voice = config.audio.voice;
  try {
    if (variant.markup && !tts.synthesizeMarkup) return { ok: false, error: `${tts.id} doesn't take markup` };
    const path = paths.audio(audioKey(variant.markup ? `ssml|${variant.text}` : variant.text, voice, tts.id, tts.format));
    const cached = (await sizeOf(path)) != null;
    if (!cached) {
      const mp3 = variant.markup ? await tts.synthesizeMarkup!(variant.text, voice) : await tts.synthesize(variant.text, voice);
      await putBytes(path, mp3, "audio/mpeg");
    }
    return { ok: true, src: `/audio/${path}`, cached };
  } catch (e) {
    return { ok: false, error: (e instanceof Error ? e.message : String(e)).slice(0, 300) };
  }
}
