import { z } from "zod";
import { applyClaudeEdits, applyRules, type SpokenSegment } from "@/audio/spoken";
import { config } from "@/lib/config";
import { structuredCall } from "@/lib/llm";
import type { SpeakInput, SpeakResult, SpokenScriptWriter } from "../types";

/**
 * The spoken-script pass (docs/pronunciation.md). Rules from the listening test of 2026-11-26 (Aria on free edge-tts).
 * Claude returns small find/replace edits, never a rewrite; src/audio/spoken.ts checks and applies them.
 */
export const SPEAK_SYSTEM = `You prepare a news podcast script for a text-to-speech voice (Microsoft Edge "Aria", free tier). You do not rewrite anything. You return a short list of find/replace edits that fix words the voice would mispronounce. Everything you don't edit is read exactly as written.

A listening test showed the voice reads most news text correctly as written, and that well-meant respellings often make it worse. So edit only where the voice is likely to go wrong, and leave everything else alone. Most segments need zero to three edits. An empty list is a good answer.

Already done in code before you see the text (don't redo): units and symbols (degrees, mph, basis points, percent), money shorthand ("1.2 billion dollars"), time zones ("Eastern"), month abbreviations, titles ("Senator", "Governor"), party labels ("Republican of Texas"), "WHO" → "W.H.O.", and accents removed ("Sao Paulo", "Erdogan").

What to fix:
1. Heteronyms where the voice may pick the wrong sound: "lead" meaning the metal → "led"; past-tense "read" where the sentence doesn't make the tense obvious → "red"; also live, wind, tear, wound, close, minute, does, dove, bass, row, sow, desert, use when the context makes the less common reading the right one.
2. Stress-shift words used as the less common part of speech: "perfect" as a verb → "pur-fect". (The voice already got verb "record" and "present" right: leave those.)
3. Names the voice is likely to say wrong because of non-English spelling: "Sheinbaum" → "Shane-bowm", "Erdogan" → "Air-doh-ahn". Leave well-known names alone: the voice said Zelenskyy, Buttigieg, Kamala, Worcester, Kyiv, Qatar, Nvidia and xAI correctly, and respellings broke them.
4. Initialisms that spell a common English word and would be read as that word ("WHO" is handled; also e.g. "IT" meaning information technology → "I.T."). Leave US, NATO, NAACP, FBI, EU, GOP and similar alone: they're read right.
5. Words in all capitals for emphasis ("NOT", "SHE"): write them in lowercase. The voice spells capitals out, and it can't stress a word anyway.
6. Missing commas that a listener needs: garden-path sentences ("While the senator ate the committee voted" → add a comma after "ate"), or a long run-on clause. Only where the sentence would genuinely be misheard.

How to respell:
- Use lowercase syllables made of real English words or obvious sounds, joined by hyphens: "pur-fect", "led", "Shane-bowm", "Air-doh-ahn", "Wooster", "Cutter". A name may start with a capital letter; nothing else may be capitalized.
- NEVER put capitals inside a respelling to show stress ("per-FECT", "zeh-LEN-skee", "POH-lish"): the voice spells capitals out letter by letter.
- No markup, tags, phonetic alphabets or brackets. Plain text only.
- Don't change words, word order, numbers already written out, or meaning. Don't fix grammar or style.
- Don't touch: "Plan B", "Grade A", "Roe v. Wade" (keep the period), "AT&T", "and/or", dashes and ellipses, hyphenated codes like F-35, H-1B, COVID-19, 401(k), vote tallies like 52-48, decades and years, Roman numerals.

Each edit:
- segment: the segment id exactly as given.
- find: the exact text to replace, copied character for character from that segment. Every occurrence in the segment is replaced, so include a neighboring word when only one occurrence should change. Keep it short (a word or a few words).
- replace: the new text.
- kind: one of heteronym, stress, name, initialism, caps, comma, other.
- why: a few words.
Spell a recurring name the same way in every segment.`;

export const SpeakOutput = z.object({
  edits: z.array(z.object({ segment: z.string(), find: z.string(), replace: z.string(), kind: z.string(), why: z.string() })),
});
export type SpeakOutput = z.infer<typeof SpeakOutput>;

/** Fixed lines the user wrote: their reading is intended as is (the welcome's "read" is "reed"), so Claude doesn't see them. */
export const FIXED_KINDS = new Set(["welcome", "outro"]);

export function buildSpeakUser(segments: { id: string; kind: string; text: string }[]): string {
  return `SEGMENTS (id | kind, then the text):\n\n${segments.map((s) => `[${s.id} | ${s.kind}]\n${s.text}`).join("\n\n")}`;
}

/** Rules on every segment, then Claude's checked edits on the non-fixed ones. */
export function combine(input: SpeakInput, out: SpeakOutput | null): SpokenSegment[] {
  return input.segments.map((s) => {
    const ruled = applyRules(s.text);
    const mine = FIXED_KINDS.has(s.kind) ? [] : (out?.edits ?? []).filter((e) => e.segment === s.id);
    const claude = applyClaudeEdits(ruled.text, mine.map(({ find, replace, kind, why }) => ({ find, replace, kind, why })));
    return { segmentId: s.id, kind: s.kind, storyId: s.storyId, text: s.text, spoken: claude.text, edits: [...ruled.edits, ...claude.applied], rejected: claude.rejected };
  });
}

export const sonnetSpokenV1: SpokenScriptWriter = {
  id: "sonnet-spoken-v1",
  async speak(input: SpeakInput): Promise<SpeakResult> {
    const warnings: string[] = [];
    const forClaude = input.segments.filter((s) => !FIXED_KINDS.has(s.kind)).map((s) => ({ id: s.id, kind: s.kind, text: applyRules(s.text).text }));
    let out: SpeakOutput | null = null;
    let usage: SpeakResult["usage"] = [];
    if (forClaude.length) {
      try {
        const r = await structuredCall({
          model: config.models.speak,
          system: SPEAK_SYSTEM,
          user: buildSpeakUser(forClaude),
          schema: SpeakOutput,
          maxTokens: config.speak.maxTokens,
          effort: config.speak.effort as "low" | "medium" | "high",
        });
        out = r.data;
        usage = r.usage;
        const ids = new Set(forClaude.map((s) => s.id));
        for (const e of out.edits) if (!ids.has(e.segment)) warnings.push(`edit for unknown segment "${e.segment}" ignored`);
      } catch (e) {
        // The rules alone still make a better spoken text than none; an episode shouldn't fail over this pass.
        warnings.push(`Claude pass failed, rules only: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return { segments: combine(input, out), usage, warnings };
  },
};

/** Code rules only (no Claude call). */
export const rulesOnly: SpokenScriptWriter = {
  id: "rules-only",
  async speak(input) {
    return { segments: combine(input, null), usage: [], warnings: [] };
  },
};

/** No changes: the voice reads the display text (how it worked before). */
export const noSpoken: SpokenScriptWriter = {
  id: "none",
  async speak(input) {
    return { segments: input.segments.map((s) => ({ segmentId: s.id, kind: s.kind, storyId: s.storyId, text: s.text, spoken: s.text, edits: [], rejected: [] })), usage: [], warnings: [] };
  },
};
