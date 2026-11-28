"use server";

import { redirect } from "next/navigation";
import { applyRules } from "@/audio/spoken";
import { config } from "@/lib/config";
import { paths, putBytes, putJson, sizeOf } from "@/lib/storage";
import type { TemplateKind } from "@/lib/types";
import { refreshFixedSegments } from "@/pipeline/phase2";
import { audioKey } from "@/pipeline/phase3";
import { SHOW_TEXT_PATH, saveShowText } from "@/show/store";
import { impls, type Methods } from "@/stages/registry";
import { TEMPLATE_KINDS } from "@/stages/script/templates";

// Behind the password gate in proxy.ts (same as the other /debug pages).

const back = (msg: string) => redirect(`/debug/show?msg=${encodeURIComponent(msg)}&t=${Date.now()}`);

export async function saveShowTextAction(fd: FormData) {
  const text = Object.fromEntries(TEMPLATE_KINDS.map((k) => [k, String(fd.get(k) ?? "").trim().slice(0, 1000)])) as Record<TemplateKind, string>;
  if (text.rundown && !text.rundown.includes("{stories}")) back("Not saved: the rundown needs {stories} where the story list goes (or leave it empty to skip the rundown).");
  await saveShowText(text);
  back("Saved. Scripts written from now on use these lines.");
}

export async function resetShowTextAction() {
  await putJson(SHOW_TEXT_PATH, null);
  back("Back to the default lines.");
}

/** Voice one line with the episode voice, through the same audio cache and code rules the episode uses. */
export async function hearLineAction(fd: FormData) {
  const text = applyRules(String(fd.get("text") ?? "").trim().slice(0, 1000)).text;
  if (!text) back("Nothing to voice.");
  const tts = impls.tts(config.methods as Methods);
  const path = paths.audio(audioKey(text, config.audio.voice, tts.id, tts.format));
  try {
    if ((await sizeOf(path)) == null) await putBytes(path, await tts.synthesize(text, config.audio.voice), "audio/mpeg");
  } catch (e) {
    back(`Couldn't voice it: ${e instanceof Error ? e.message : String(e)}`);
  }
  redirect(`/debug/show?play=${encodeURIComponent(path)}&t=${Date.now()}`);
}

export async function useOnRunAction(fd: FormData) {
  const runId = String(fd.get("runId") ?? "");
  const { changed } = await refreshFixedSegments(runId);
  back(changed.length ? `Run ${runId}: updated ${changed.join(", ")}. Now open the run and press "Re-make audio" to hear it.` : `Run ${runId} already has these lines.`);
}
