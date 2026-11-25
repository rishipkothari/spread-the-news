"use server";

import { headers } from "next/headers";
import { basicAuthOk } from "@/lib/auth";
import { clockLabel, FEEDBACK_AREAS, type FeedbackInput } from "@/feedback/format";
import { momentContext, type MomentTrack } from "@/feedback/moment";
import { sendFeedback } from "@/feedback/send";

export type SendState = { ok: true; url: string; updated: boolean } | { ok: false; error: string };

/**
 * Only the signed-in owner can send (the same password as the admin pages). Today every page is behind it already;
 * this keeps the buttons safe once public pages stop asking for the password.
 */
async function signedIn(): Promise<boolean> {
  return basicAuthOk((await headers()).get("authorization"));
}

function fail(e: unknown): SendState {
  return { ok: false, error: (e instanceof Error ? e.message : String(e)).slice(0, 400) };
}

/** "Send to Claude": any page's report and note become a GitHub issue Claude reads. */
export async function sendFeedbackAction(input: FeedbackInput): Promise<SendState> {
  if (!(await signedIn())) return { ok: false, error: "Sign in first: open /debug and enter the password, then try again." };
  if (!FEEDBACK_AREAS.includes(input.area)) return { ok: false, error: `unknown feedback area "${input.area}"` };
  if (!input.note?.trim() && !input.report?.trim()) return { ok: false, error: "Nothing to send: write a note first." };
  try {
    const firstLine = input.note?.trim().split("\n")[0].slice(0, 70);
    const title = input.area === "general" && firstLine ? `Note: ${firstLine}` : input.title || `Feedback: ${input.area}`;
    const r = await sendFeedback({ ...input, note: input.note?.slice(0, 20_000), title });
    return { ok: true, url: r.url, updated: r.updated };
  } catch (e) {
    return fail(e);
  }
}

/** Player "Flag this moment": the track, the second, the sentence that was playing and the user's note. */
export async function flagMomentAction(track: MomentTrack, atSec: number, durationSec: number, note: string): Promise<SendState> {
  if (!(await signedIn())) return { ok: false, error: "Sign in first: open /debug and enter the password, then try again." };
  try {
    const ctx = await momentContext(track, atSec, durationSec);
    const at = clockLabel(atSec);
    const quote = ctx.located
      ? [ctx.located.before && `> ${ctx.located.before}`, `> **${ctx.located.sentence}**`, ctx.located.after && `> ${ctx.located.after}`].filter(Boolean).join("\n")
      : "_(couldn't find the text for this track)_";
    const report = [
      `**Track:** ${track.title} (${track.kind}) at **${at}** of ${clockLabel(durationSec || track.durationSec)}`,
      "",
      "Probably playing (estimated from position, ± a sentence):",
      "",
      quote,
      ...(ctx.text ? ["", "<details><summary>Full segment text</summary>", "", ctx.text, "", "</details>"] : []),
    ].join("\n");
    const day = ctx.date ?? track.id.slice(0, 10);
    const r = await sendFeedback({
      area: "player",
      key: `player:${day}`,
      title: `Listening notes ${day}`,
      note: `${at} · ${track.title}: ${note.trim() || "(flagged, no note)"}`,
      report,
      data: { track, atSec: Math.round(atSec * 10) / 10, durationSec, date: ctx.date, runId: ctx.runId, segmentId: ctx.segmentId, sentenceIndex: ctx.located?.index },
      page: "player",
    });
    return { ok: true, url: r.url, updated: r.updated };
  } catch (e) {
    return fail(e);
  }
}
