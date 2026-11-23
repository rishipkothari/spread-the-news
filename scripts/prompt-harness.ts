/**
 * Offline prompt harness for Phase 1. Builds the exact prompts the app sends and validates
 * model responses with the app's own schemas and checks (verbatim quotes, id resolution).
 *
 *   npx tsx scripts/prompt-harness.ts analyze-prompts <outDir>
 *   npx tsx scripts/prompt-harness.ts check-analyze <outDir>      (reads <outDir>/analyze-<articleId>.response.json)
 *   npx tsx scripts/prompt-harness.ts check-synth <outDir>        (reads <outDir>/synth.response.json)
 *   Phase 2, on the recorded synthesis in tests/fixtures/analysis/responses/:
 *   npx tsx scripts/prompt-harness.ts script-prompts <outDir>     (writes write.prompt.txt)
 *   npx tsx scripts/prompt-harness.ts check-script <outDir>       (reads <outDir>/segment.txt [+ check.response.json]; writes check.prompt.txt)
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { jsonSchemaFor } from "../src/lib/llm";
import type { Article, ExtractedText, Fact, HistoryStory, Story } from "../src/lib/types";
import { ANALYZE_SYSTEM, AnalyzeOutput, buildAnalyzeUser, verifyFacts } from "../src/stages/analyze/haiku-facts-v1";
import { SYNTHESIZE_SYSTEM, SynthesizeOutput, buildSynthesizeUser, resolveSynthesis } from "../src/stages/synthesize/sonnet-synthesis-v1";
import type { SynthesizeInput } from "../src/stages/types";
import { buildScriptInput } from "../src/pipeline/phase2";
import { codeChecks, lengthIssue, verdict, wordCount } from "../src/stages/script/checks";
import { WRITE_SYSTEM, WriteOutput, buildWriteUser } from "../src/stages/script/neutral-v1";
import { CHECK_SYSTEM, CheckOutput, buildCheckUser, toCheckResult } from "../src/stages/script/quote-trace-v1";
import type { Source } from "../src/lib/types";

interface FixtureArticle { article: Article; sourceName: string; lean: string; leanValue: number; text: string }
const fixture = JSON.parse(readFileSync(new URL("../tests/fixtures/analysis/story-stopgap.json", import.meta.url), "utf8")) as {
  story: Story; history: HistoryStory[]; articles: FixtureArticle[];
};

const [cmd, outDir = "harness-out"] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

const textOf = (fa: FixtureArticle): ExtractedText => ({
  articleId: fa.article.id, url: fa.article.url, text: fa.text, textStatus: fa.text.length >= 800 ? "full" : "partial",
  extractor: "fixture", chars: fa.text.length, fetchedAt: "2026-11-22T06:00:00Z",
});
const analyzable = fixture.articles.filter((a) => a.article.articleType !== "opinion");

function prompt(system: string, user: string, schema: unknown): string {
  return `=== SYSTEM ===\n${system}\n\n=== USER ===\n${user}\n\n=== OUTPUT JSON SCHEMA ===\n${JSON.stringify(schema)}\n`;
}

if (cmd === "analyze-prompts") {
  for (const fa of analyzable) {
    const user = buildAnalyzeUser({ article: fa.article, text: textOf(fa), story: { id: fixture.story.id, title: fixture.story.title }, sourceName: fa.sourceName });
    writeFileSync(join(outDir, `analyze-${fa.article.id}.prompt.txt`), prompt(ANALYZE_SYSTEM, user, jsonSchemaFor(AnalyzeOutput)));
  }
  console.log(`wrote ${analyzable.length} analyze prompts to ${outDir}`);
} else if (cmd === "check-analyze") {
  const factsBy: Record<string, Fact[]> = {};
  for (const fa of analyzable) {
    const file = join(outDir, `analyze-${fa.article.id}.response.json`);
    if (!existsSync(file)) { console.log(`${fa.article.id}: no response`); continue; }
    const parsed = AnalyzeOutput.safeParse(JSON.parse(readFileSync(file, "utf8")));
    if (!parsed.success) { console.log(`${fa.article.id}: SCHEMA FAIL ${parsed.error.message.slice(0, 300)}`); continue; }
    const { kept, dropped } = verifyFacts(parsed.data.facts, fa.text);
    factsBy[fa.article.id] = kept;
    console.log(`${fa.article.id} (${fa.sourceName}): ${kept.length} kept, ${dropped.length} dropped`);
    for (const d of dropped) console.log(`   DROPPED quote not verbatim: "${d.quote}"`);
  }
  const input: SynthesizeInput = {
    story: fixture.story,
    history: fixture.history,
    articles: fixture.articles.map((fa) => ({
      article: fa.article, sourceName: fa.sourceName, lean: fa.lean as SynthesizeInput["articles"][number]["lean"], leanValue: fa.leanValue,
      textStatus: fa.article.articleType === "opinion" ? "headline_only" : "full", facts: factsBy[fa.article.id] ?? [],
    })),
  };
  writeFileSync(join(outDir, "synth-input.json"), JSON.stringify(input, null, 2));
  writeFileSync(join(outDir, "synth.prompt.txt"), prompt(SYNTHESIZE_SYSTEM, buildSynthesizeUser(input), jsonSchemaFor(SynthesizeOutput)));
  console.log(`wrote synth prompt (${Object.values(factsBy).flat().length} facts)`);
} else if (cmd === "check-synth") {
  const input = JSON.parse(readFileSync(join(outDir, "synth-input.json"), "utf8")) as SynthesizeInput;
  const parsed = SynthesizeOutput.safeParse(JSON.parse(readFileSync(join(outDir, "synth.response.json"), "utf8")));
  if (!parsed.success) { console.log(`SCHEMA FAIL ${parsed.error.message.slice(0, 500)}`); process.exit(1); }
  const { synthesis, warnings } = resolveSynthesis(parsed.data, input);
  console.log(JSON.stringify(synthesis, null, 2));
  console.log(`warnings (${warnings.length}):`, warnings);
} else if (cmd === "script-prompts" || cmd === "check-script") {
  const dir = new URL("../tests/fixtures/analysis/responses/", import.meta.url);
  const si = JSON.parse(readFileSync(new URL("synth-input.json", dir), "utf8")) as SynthesizeInput;
  const { synthesis } = resolveSynthesis(SynthesizeOutput.parse(JSON.parse(readFileSync(new URL("synth.json", dir), "utf8"))), si);
  const sources = si.articles.map((a) => ({ id: a.article.sourceId, name: a.sourceName, leanValue: a.leanValue }) as Source);
  const input = buildScriptInput(si.story, synthesis, { articles: si.articles.map((a) => a.article), sources }, { storyId: si.story.id, title: synthesis.title, category: si.story.category, rank: 1, lead: true, wordBudget: 300 });
  if (cmd === "script-prompts") {
    writeFileSync(join(outDir, "write.prompt.txt"), prompt(WRITE_SYSTEM, buildWriteUser(input), jsonSchemaFor(WriteOutput)));
    console.log(`wrote ${join(outDir, "write.prompt.txt")}`);
  } else {
    const text = readFileSync(join(outDir, "segment.txt"), "utf8").trim();
    writeFileSync(join(outDir, "check.prompt.txt"), prompt(CHECK_SYSTEM, buildCheckUser(input, text), jsonSchemaFor(CheckOutput)));
    const code = [...codeChecks(text, sources), ...[lengthIssue(text, input.wordBudget)].filter((x) => !!x)];
    console.log(`segment: ${wordCount(text)} words; code issues: ${code.length ? code.map((i) => `${i.kind}: ${i.problem}`).join("; ") : "none"}`);
    const resp = join(outDir, "check.response.json");
    if (existsSync(resp)) {
      const parsed = CheckOutput.safeParse(JSON.parse(readFileSync(resp, "utf8")));
      if (!parsed.success) { console.log(`SCHEMA FAIL ${parsed.error.message.slice(0, 500)}`); process.exit(1); }
      const r = toCheckResult(parsed.data, input, "harness");
      const issues = [...r.issues, ...code];
      console.log(JSON.stringify({ ...r, issues, pass: verdict(r.claims, issues) }, null, 2));
    }
  }
} else {
  console.log("usage: analyze-prompts | check-analyze | check-synth | script-prompts | check-script <outDir>");
}
