import type { ArticleFacts, Source, StoryBundle, UsageEntry } from "@/lib/types";
import type { AnalysisPlan, AnalyzeOut, ExtractOut, SynthesizeOut } from "@/pipeline/phase1";

/** Compact text summary of a run's Phase 1 output, for pasting to Claude. */
export function buildAnalysisReport(
  bundle: StoryBundle,
  plan: AnalysisPlan | null,
  extract: ExtractOut | null,
  analyze: AnalyzeOut | null,
  synth: SynthesizeOut | null,
  usage: UsageEntry[],
): string {
  const sources = new Map<string, Source>(bundle.sources.map((s) => [s.id, s]));
  const name = (id: string) => sources.get(id)?.name ?? id;
  const lines: string[] = [`# Phase 1 analysis: run ${bundle.runId}`];
  const cost = (st: string) => usage.filter((u) => u.stage === st).reduce((a, u) => a + (u.costUsd ?? 0), 0);
  lines.push(`cost: extract $${cost("extract").toFixed(3)} · analyze $${cost("analyze").toFixed(3)} · synthesize $${cost("synthesize").toFixed(3)}`);
  if (extract) {
    lines.push("", "## Text extraction by source (full / partial / headline-only of attempted)");
    for (const [id, r] of Object.entries(extract.report)) {
      lines.push(`- ${name(id)}: ${r.full}/${r.partial}/${r.headline_only} of ${r.attempted} · via ${Object.entries(r.byExtractor).map(([k, v]) => `${k} ${v}`).join(", ")}${r.errors.length ? ` · e.g. ${r.errors[0]}` : ""}`);
    }
  }
  if (analyze) {
    const analyzed = analyze.facts.filter((f) => !f.skipped);
    lines.push("", `## Facts: ${analyzed.length} articles analyzed, ${analyze.facts.reduce((a, f) => a + f.facts.length, 0)} facts, ${analyze.errors.length} errors`);
    for (const e of analyze.errors.slice(0, 5)) lines.push(`- error: ${e}`);
  }
  if (synth) {
    const factsByArticle = new Map<string, ArticleFacts>((analyze?.facts ?? []).map((f) => [f.articleId, f]));
    const articleSource = new Map(bundle.articles.map((a) => [a.id, a.sourceId]));
    const order = plan?.storyIds ?? synth.syntheses.map((s) => s.storyId);
    lines.push("", `## Stories (${synth.syntheses.length})`);
    order.forEach((id, i) => {
      const s = synth.syntheses.find((x) => x.storyId === id);
      if (!s) {
        const title = bundle.stories.find((x) => x.id === id)?.title ?? id;
        if (synth.skipped?.includes(id)) lines.push("", `### ${i + 1}. ${title}`, "(headlines only: no article text, not synthesized)");
        return;
      }
      const chosen = plan?.articleIds[id] ?? [];
      const withFacts = chosen.filter((a) => (factsByArticle.get(a)?.facts.length ?? 0) > 0).length;
      lines.push("", `### ${i + 1}. ${s.title}`, `(${chosen.length} articles, ${withFacts} with facts)`, s.summary);
      if (s.recently) lines.push(`Recently: ${s.recently}`);
      for (const f of s.agreedFacts) lines.push(`- AGREED: ${f.fact} [${[...new Set(f.support.map((x) => name(articleSource.get(x.articleId) ?? "?")))].join(", ")}]`);
      for (const f of s.singleSourceFacts ?? []) lines.push(`- ONLY ${name(f.sourceId)}: ${f.fact}`);
      for (const d of s.disputed) lines.push(`- DISPUTED (${d.significance ?? "material"}): ${d.claim} → ${d.positions.map((p) => `${p.position} [${p.sourceIds.map(name).join(", ")}]`).join(" | ")}`);
      for (const [side, f] of Object.entries(s.framing)) lines.push(`- FRAMING ${side}: ${f}`);
    });
    for (const e of synth.errors) lines.push(`- synthesis error: ${e}`);
  }
  return lines.join("\n");
}
