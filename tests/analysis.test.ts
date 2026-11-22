import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AnalyzeOutput, buildAnalyzeUser, verifyFacts } from "@/stages/analyze/haiku-facts-v1";
import { normalizeForMatch, quoteInText } from "@/stages/analyze/quotes";
import { SynthesizeOutput, buildSynthesizeUser, resolveSynthesis } from "@/stages/synthesize/sonnet-synthesis-v1";
import type { SynthesizeInput } from "@/stages/types";

// Responses recorded from Claude (Haiku for facts, Sonnet for synthesis) on the fictional
// multi-outlet fixture story, via scripts/prompt-harness.ts. They pin the parsing and checks.
const load = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/analysis/${name}`, import.meta.url), "utf8"));
const story = load("story-stopgap.json");

describe("verbatim quotes", () => {
  it("normalizes quotes, dashes and whitespace", () => {
    expect(normalizeForMatch("“Keeps the  lights on” — he said’s")).toBe('"keeps the lights on" - he said\'s');
    expect(quoteInText("The vote was 60 to 38.", "Averting a shutdown. The vote was 60 to 38.\n\nMore")).toBe(true);
    expect(quoteInText("“This is not the bill any of us would have written”", '"This is not the bill any of us would have written," Doe said')).toBe(true);
    expect(quoteInText("The Senate voted ... averting a shutdown", "The Senate voted on Friday, averting a shutdown")).toBe(true);
    expect(quoteInText("The Senate unanimously voted", "The Senate voted 60 to 38")).toBe(false);
    expect(quoteInText("short", "short")).toBe(false);
  });
});

describe("article facts (recorded Haiku responses)", () => {
  for (const fa of story.articles.filter((a: { article: { articleType: string } }) => a.article.articleType !== "opinion")) {
    it(`${fa.sourceName}: schema-valid and every quote is verbatim`, () => {
      const parsed = AnalyzeOutput.parse(load(`responses/analyze-${fa.article.id}.json`));
      const { kept, dropped } = verifyFacts(parsed.facts, fa.text);
      expect(dropped).toEqual([]);
      expect(kept.length).toBeGreaterThanOrEqual(5);
      expect(kept.filter((f) => f.kind === "statement").every((f) => f.speaker)).toBe(true);
    });
  }

  it("drops facts whose quote isn't in the text", () => {
    const { kept, dropped } = verifyFacts(
      [{ claim: "x", quote: "The Senate voted unanimously to pass it", kind: "event" }, { claim: "y", quote: "The vote was 60 to 38.", kind: "event" }],
      story.articles[0].text,
    );
    expect(kept.map((f) => f.claim)).toEqual(["y"]);
    expect(dropped).toHaveLength(1);
  });

  it("flags partial text in the prompt", () => {
    const fa = story.articles[0];
    const user = buildAnalyzeUser({ article: fa.article, text: { articleId: "x", url: "", text: "abc", textStatus: "partial", extractor: "x", chars: 3, fetchedAt: "" }, story: { id: "s", title: "T" }, sourceName: "MJ" });
    expect(user).toContain("NOTE: the text below is incomplete");
  });
});

describe("story synthesis (recorded Sonnet response)", () => {
  const input = load("responses/synth-input.json") as SynthesizeInput;
  const out = SynthesizeOutput.parse(load("responses/synth.json"));

  it("resolves every cited fact id to a real article and verbatim quote", () => {
    const { synthesis, warnings } = resolveSynthesis(out, input);
    expect(warnings).toEqual([]);
    expect(synthesis.agreedFacts.length).toBeGreaterThan(3);
    const textById = new Map(story.articles.map((a: { article: { id: string }; text: string }) => [a.article.id, a.text]));
    for (const af of synthesis.agreedFacts) for (const s of af.support) expect(quoteInText(s.quote, textById.get(s.articleId) as string)).toBe(true);
    expect(synthesis.disputed.length).toBeGreaterThanOrEqual(2);
    expect(Object.keys(synthesis.framing).sort()).toEqual(["center", "left", "right"]);
    expect(synthesis.recently).toBeTruthy();
  });

  it("drops unknown ids, unsupported facts, framing for absent sides, and 'recently' without history", () => {
    const bogus = { ...out, agreedFacts: [{ fact: "Made up", factIds: ["a9.f9"] }, ...out.agreedFacts], framing: { ...out.framing } };
    const leftless = { ...input, history: [], articles: input.articles.filter((a) => a.leanValue >= 0) };
    const { synthesis, warnings } = resolveSynthesis(bogus, leftless);
    expect(synthesis.agreedFacts.find((f) => f.fact === "Made up")).toBeUndefined();
    expect(synthesis.framing.left).toBeUndefined();
    expect(synthesis.recently).toBeUndefined();
    expect(warnings.some((w) => w.includes("a9.f9"))).toBe(true);
  });

  it("labels opinion and headline-only articles in the prompt", () => {
    const user = buildSynthesizeUser(input);
    expect(user).toContain("(opinion, no facts extracted)");
    expect(user).toContain("RECENT HISTORY");
    expect(user).toMatch(/a1\.f1 \(event\)/);
  });
});
