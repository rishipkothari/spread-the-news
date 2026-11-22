import { z } from "zod";
import { config } from "@/lib/config";
import { structuredCall } from "@/lib/llm";
import type { LeanGroup, StorySynthesis } from "@/lib/types";
import { leanGroup } from "../rank/headline-index-v1";
import type { StorySynthesizer, SynthesizeInput } from "../types";

export const SYNTHESIZE_SYSTEM = `You compare how outlets across the political spectrum covered one news story, for a neutral daily news podcast. You receive the story, the articles (outlet, its lean, article type, headline) and the facts already extracted from each article, each with an id like a2.f3. You may also receive RECENT HISTORY: earlier stories this one continues.

Return:
- title: a short neutral headline for the story.
- summary: 2–4 sentences a listener could hear as the core of the story, using only facts supported by the articles. Neutral wording; attribute contested claims ("X said…"), and attribute facts that only one outlet reports ("according to BBC News…").
- agreedFacts: the key facts of the story. Each has fact (one neutral sentence) and factIds (every supporting fact id, across all outlets that report it). Include facts reported by only one outlet too, as long as no outlet contradicts them; they'll be shown as single-source.
- disputed: points of disagreement present in the material. Each has claim (what's in dispute, neutrally) and positions: each position states one side's view and lists the article ids (a1, a2…) that carry it and, where possible, the fact ids that support it. Look for three kinds:
  1. people or groups quoted in the coverage disagreeing about the story: whether something is adequate, justified, effective, or who is responsible (e.g. a sum one side calls a fair compromise and the other calls far too small; an amendment one party pushed and the other blocked);
  2. outlets reporting different facts: different numbers, dates, counts or sequences of events;
  3. claims one outlet treats as fact that another attributes or questions.
  Every position must be a view someone actually holds; "reported it without comment" is not a position. Don't list a disagreement as an agreed fact. Include only disagreements present in the material; an empty list is fine.
- framing: for each side that covered the story (left, center, right), one sentence on what that side's coverage emphasizes or how it frames the story, judged from headlines, article types and chosen facts. Describe, don't judge. Omit a side with no coverage.
- recently: only if RECENT HISTORY is given, one or two sentences on what happened before, from that history alone. Otherwise omit.

Rules:
- Use only the material provided. Never add outside knowledge, even if you think it's true.
- Every agreedFacts entry must cite at least one fact id from the list.
- Opinion pieces and headline-only articles have no facts; use them only for framing.`;

export function factId(articleIndex: number, factIndex: number): string {
  return `a${articleIndex + 1}.f${factIndex + 1}`;
}

export function buildSynthesizeUser(input: SynthesizeInput): string {
  const lines: string[] = [`STORY: ${input.story.title} (category: ${input.story.category})`, ""];
  if (input.history.length) {
    lines.push("RECENT HISTORY (oldest first):");
    for (const h of input.history) lines.push(`- ${h.date}: ${h.title}${h.summary ? `: ${h.summary}` : ""}`);
    lines.push("");
  }
  lines.push("ARTICLES:");
  input.articles.forEach((a, i) => {
    const group = leanGroup(a.leanValue);
    const kind = a.article.articleType ?? "news";
    const note = kind === "opinion" ? " (opinion, no facts extracted)" : a.textStatus === "headline_only" ? " (headline only, no facts extracted)" : "";
    lines.push(`a${i + 1} | ${a.sourceName} | lean: ${a.lean} (${group}) | ${kind}${note}`);
    lines.push(`   headline: ${a.article.title}`);
    a.facts.forEach((f, j) => {
      const who = f.kind === "statement" && f.speaker ? ` [${f.speaker}]` : "";
      lines.push(`   ${factId(i, j)} (${f.kind})${who}: ${f.claim}`);
    });
  });
  return lines.join("\n");
}

export const SynthesizeOutput = z.object({
  title: z.string(),
  summary: z.string(),
  agreedFacts: z.array(z.object({ fact: z.string(), factIds: z.array(z.string()) })),
  disputed: z.array(
    z.object({
      claim: z.string(),
      positions: z.array(z.object({ position: z.string(), articleIds: z.array(z.string()), factIds: z.array(z.string()).optional() })),
    }),
  ),
  framing: z.object({ left: z.string().optional(), center: z.string().optional(), right: z.string().optional() }),
  recently: z.string().optional(),
});
export type SynthesizeOutput = z.infer<typeof SynthesizeOutput>;

/** Resolve fact/article ids to real articles and verbatim quotes; drop anything that doesn't resolve. */
export function resolveSynthesis(out: SynthesizeOutput, input: SynthesizeInput): { synthesis: StorySynthesis; warnings: string[] } {
  const warnings: string[] = [];
  const fact = (id: string) => {
    const m = id.trim().match(/^a(\d+)\.f(\d+)$/);
    const a = m ? input.articles[Number(m[1]) - 1] : undefined;
    const f = a && m ? a.facts[Number(m[2]) - 1] : undefined;
    if (!a || !f) warnings.push(`unknown fact id ${id}`);
    return a && f ? { articleId: a.article.id, sourceId: a.article.sourceId, quote: f.quote } : null;
  };
  const article = (id: string) => {
    const m = id.trim().match(/^a(\d+)$/);
    const a = m ? input.articles[Number(m[1]) - 1] : undefined;
    if (!a) warnings.push(`unknown article id ${id}`);
    return a ?? null;
  };

  // A fact is "agreed" only when two or more outlets support it; otherwise it's single-source.
  const resolved = out.agreedFacts
    .map((af) => ({ fact: af.fact.trim(), refs: af.factIds.map(fact).filter((x): x is NonNullable<typeof x> => !!x) }))
    .filter((af) => {
      if (!af.refs.length) warnings.push(`fact without valid support dropped: "${af.fact}"`);
      return af.refs.length > 0 && af.fact.length > 0;
    });
  const support = (refs: { articleId: string; quote: string }[]) => refs.map(({ articleId, quote }) => ({ articleId, quote }));
  const agreedFacts = resolved.filter((af) => new Set(af.refs.map((r) => r.sourceId)).size >= 2).map((af) => ({ fact: af.fact, support: support(af.refs) }));
  const singleSourceFacts = resolved
    .filter((af) => new Set(af.refs.map((r) => r.sourceId)).size < 2)
    .map((af) => ({ fact: af.fact, sourceId: af.refs[0].sourceId, support: support(af.refs) }));

  const disputed = out.disputed
    .map((d) => ({
      claim: d.claim.trim(),
      positions: d.positions
        .map((p) => {
          const arts = p.articleIds.map(article).filter((a): a is NonNullable<typeof a> => !!a);
          const support = (p.factIds ?? []).map(fact).find((x) => !!x);
          return {
            position: p.position.trim(),
            sourceIds: [...new Set(arts.map((a) => a.article.sourceId))],
            ...(support ? { quote: support.quote, articleId: support.articleId } : {}),
          };
        })
        .filter((p) => p.sourceIds.length > 0 && p.position.length > 0),
    }))
    .filter((d) => d.positions.length >= 1 && d.claim.length > 0);

  // Framing only for sides that actually covered the story.
  const present = new Set<LeanGroup>(input.articles.map((a) => leanGroup(a.leanValue)));
  const framing: StorySynthesis["framing"] = {};
  for (const side of ["left", "center", "right"] as LeanGroup[]) {
    const v = out.framing[side]?.trim();
    if (!v) continue;
    if (present.has(side)) framing[side] = v;
    else warnings.push(`framing for ${side} dropped: no ${side} coverage`);
  }

  const recently = input.history.length && out.recently?.trim() ? out.recently.trim() : undefined;
  return {
    synthesis: {
      storyId: input.story.id,
      title: out.title.trim() || input.story.title,
      summary: out.summary.trim(),
      agreedFacts,
      singleSourceFacts,
      disputed,
      framing,
      ...(recently ? { recently } : {}),
    },
    warnings,
  };
}

export const sonnetSynthesisV1: StorySynthesizer = {
  id: "sonnet-synthesis-v1",
  async synthesize(input) {
    const { data, usage } = await structuredCall({
      model: config.models.synthesize,
      system: SYNTHESIZE_SYSTEM,
      user: buildSynthesizeUser(input),
      schema: SynthesizeOutput,
      maxTokens: config.analysis.synthesizeMaxTokens,
      effort: config.analysis.synthesizeEffort as "low" | "medium" | "high",
    });
    const { synthesis, warnings } = resolveSynthesis(data, input);
    if (warnings.length) usage[0] = { ...usage[0], note: warnings.slice(0, 5).join("; ") };
    return { synthesis, usage };
  },
};
