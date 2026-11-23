import { z } from "zod";
import { config } from "@/lib/config";
import { structuredCall } from "@/lib/llm";
import type { Revision, ScriptInput, ScriptWriter } from "../types";
import { buildMaterial } from "./material";
import { TONE_RULES } from "./tone";

export const WRITE_SYSTEM = `You write one story segment for Spread the News, a daily news podcast read aloud by a single nameless narrator. Each episode reads coverage from outlets across the political spectrum and tells the listener what happened, plainly and fairly.

You receive the STORY MATERIAL for one story: facts checked against the outlets' articles, any disagreements between them, and how each side of the spectrum framed it. Every factual statement in your segment must come from that material. Never add outside knowledge, even if you are sure it's true: no extra names, numbers, dates, history or context. A fact checker will trace every claim back to the material and reject the segment if anything doesn't match.

How a segment goes:
1. Open with what happened, in a sentence a listener grasps on first hearing.
2. Give the key facts and why the story matters, using only the material. Explain who people are in a clause when the material says so.
3. Where outlets disagree, say so and say who holds each position by side ("left-leaning outlets report… while right-leaning ones…"). If every position came from one outlet, present it as that outlet's report of conflicting claims, not as a debate between sides.
4. Optionally, one sentence on how coverage differed across the spectrum, from the FRAMING lines, only if the sides really emphasized different things. Skip it otherwise.
5. End cleanly. No sign-off, no "stay tuned", no transition to the next story: segments are joined later.

Style rules (from the show's tone guide):
${TONE_RULES}

Return JSON with one field, "segment": the text to be read aloud, as plain sentences in one or more paragraphs.`;

function revisionNote(r: Revision): string {
  const issues = r.issues.map((i) => `- [${i.kind}] "${i.excerpt}": ${i.problem}${i.fix ? ` Fix: ${i.fix}` : ""}`);
  const unsupported = r.claims.filter((c) => c.status !== "supported").map((c) => `- [${c.status}] ${c.claim}`);
  return [
    "YOUR PREVIOUS DRAFT FAILED THE FACT AND TONE CHECK. Rewrite it so every problem below is fixed. Keep what was fine; remove anything the material can't support.",
    "",
    "PREVIOUS DRAFT:",
    r.text,
    "",
    "PROBLEMS:",
    ...issues,
    ...unsupported,
  ].join("\n");
}

export function buildWriteUser(input: ScriptInput, revision?: Revision): string {
  const parts = [
    "STORY MATERIAL:",
    buildMaterial(input),
    "",
    `LENGTH: about ${input.wordBudget} words${input.lead ? " (this is the episode's top story)" : ""}. Shorter is fine if the material is thin; never pad.`,
  ];
  if (revision) parts.push("", revisionNote(revision));
  return parts.join("\n");
}

export const WriteOutput = z.object({ segment: z.string() });

export const neutralV1: ScriptWriter = {
  id: "neutral-v1",
  async write(input, revision) {
    const { data, usage } = await structuredCall({
      model: config.models.script,
      system: WRITE_SYSTEM,
      user: buildWriteUser(input, revision),
      schema: WriteOutput,
      maxTokens: config.script.maxTokens,
      effort: config.script.writeEffort as "low" | "medium" | "high",
    });
    return { text: data.segment.trim(), usage };
  },
};
