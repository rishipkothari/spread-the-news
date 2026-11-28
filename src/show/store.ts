import { config } from "@/lib/config";
import { getJson, putJson } from "@/lib/storage";
import type { TemplateKind } from "@/lib/types";

/**
 * The show's fixed lines (welcome, rundown, sign-off). config/pipeline.json → script.welcome / rundown / outro is the
 * default; edits made on /debug/show are saved to Blob and used by every script written after that.
 */
export const SHOW_TEXT_PATH = "config/show-text.json";

export type ShowText = Record<TemplateKind, string>;
interface Stored extends Partial<ShowText> {
  updatedAt: string;
}

export function defaultShowText(): ShowText {
  return { welcome: config.script.welcome ?? "", rundown: config.script.rundown ?? "", outro: config.script.outro ?? "" };
}

export async function loadShowText(): Promise<ShowText & { origin: "blob" | "repo"; updatedAt?: string }> {
  const stored = await getJson<Stored>(SHOW_TEXT_PATH).catch(() => null);
  const d = defaultShowText();
  if (!stored) return { ...d, origin: "repo" };
  return {
    welcome: stored.welcome ?? d.welcome,
    rundown: stored.rundown ?? d.rundown,
    outro: stored.outro ?? d.outro,
    origin: "blob",
    updatedAt: stored.updatedAt,
  };
}

export async function saveShowText(text: ShowText): Promise<void> {
  await putJson(SHOW_TEXT_PATH, { ...text, updatedAt: new Date().toISOString() } satisfies Stored);
}
