import { z } from "zod";
import { config } from "@/lib/config";
import { structuredCall } from "@/lib/llm";
import type { Fact } from "@/lib/types";
import type { AnalyzeInput, ArticleAnalyzer } from "../types";
import { quoteInText } from "./quotes";

export const ANALYZE_SYSTEM = `You extract facts from one news article for a neutral daily news digest. Another step later compares facts across outlets with different political leanings, and a fact-checker traces every sentence of the final script back to your quotes, so precision matters more than coverage.

Return the 5–15 most important facts about the story named below. For each fact:
- claim: the fact restated neutrally and self-contained (names, numbers, dates spelled out; no "he" or "the bill" without saying who or which). Do not add anything the article doesn't say.
- quote: an exact, verbatim excerpt from the article text that supports the claim: one or two consecutive sentences, at most 300 characters, copied character for character. Never paraphrase, merge distant sentences, or fix typos inside the quote.
- kind: "event" (something that happened), "statistic" (a number or measurement), "statement" (something a person or organization said or claimed), or "background" (context from before this news).
- speaker: for statements, who said it (name and role as the article gives them).

Rules:
- The outlet's own characterizations, predictions and loaded wording are not facts. If they matter, record them only as a statement attributed to whoever made them, or leave them out.
- Contested claims are statements with a speaker, not events.
- Prefer facts about the named story; skip unrelated material, author bios, newsletter prompts and boilerplate.
- If the text holds no usable facts about the story, return an empty list.`;

export function buildAnalyzeUser(input: AnalyzeInput, maxChars = config.analysis.maxCharsForLlm): string {
  const text = input.text.text ?? "";
  const clipped = text.length > maxChars ? `${text.slice(0, maxChars)}\n[…truncated]` : text;
  return [
    `STORY: ${input.story.title}`,
    `OUTLET: ${input.sourceName}`,
    `ARTICLE TYPE: ${input.article.articleType ?? "news"}`,
    `HEADLINE: ${input.article.title}`,
    `PUBLISHED: ${input.article.publishedAt}`,
    input.text.textStatus === "partial" ? `NOTE: the text below is incomplete (paywall or truncation); extract only what it contains.` : "",
    ``,
    `ARTICLE TEXT:`,
    clipped,
  ]
    .filter((l) => l !== "")
    .join("\n");
}

export const AnalyzeOutput = z.object({
  facts: z.array(
    z.object({
      claim: z.string(),
      quote: z.string(),
      kind: z.enum(["event", "statistic", "statement", "background"]),
      speaker: z.string().optional(),
    }),
  ),
});

/** Keep only facts whose quote really is in the text; report how many were dropped. */
export function verifyFacts(facts: z.infer<typeof AnalyzeOutput>["facts"], text: string): { kept: Fact[]; dropped: { claim: string; quote: string }[] } {
  const kept: Fact[] = [];
  const dropped: { claim: string; quote: string }[] = [];
  for (const f of facts) {
    if (!f.claim.trim() || !quoteInText(f.quote, text)) {
      dropped.push({ claim: f.claim, quote: f.quote });
      continue;
    }
    kept.push({ claim: f.claim.trim(), quote: f.quote.trim(), kind: f.kind, ...(f.speaker?.trim() ? { speaker: f.speaker.trim() } : {}) });
  }
  return { kept, dropped };
}

export const haikuFactsV1: ArticleAnalyzer = {
  id: "haiku-facts-v1",
  async analyze(input) {
    const { data, usage } = await structuredCall({
      model: config.models.analyze,
      system: ANALYZE_SYSTEM,
      user: buildAnalyzeUser(input),
      schema: AnalyzeOutput,
      maxTokens: config.analysis.analyzeMaxTokens,
      effort: config.analysis.analyzeEffort as "low" | "medium" | "high",
    });
    const { kept, dropped } = verifyFacts(data.facts, input.text.text ?? "");
    if (dropped.length) usage[0] = { ...usage[0], note: `${dropped.length} fact(s) dropped: quote not found verbatim` };
    return { facts: kept, usage };
  },
};
