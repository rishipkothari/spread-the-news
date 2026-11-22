import type { Article, Source, Story, StoryBundle, UsageEntry } from "@/lib/types";
import { type RunReview, VERDICT_LABEL } from "./types";

const pct = (n?: number) => (n == null ? "–" : `${Math.round(n * 100)}`);

function storyLine(s: Story, i: number | null, articles: Map<string, Article>, sources: Map<string, Source>): string {
  const sig = s.signals;
  const arts = s.articleIds.map((id) => articles.get(id)).filter((a): a is Article => !!a);
  const outlets = [...new Set(arts.map((a) => sources.get(a.sourceId)?.name ?? a.sourceId))];
  const mix = sig ? `L${sig.leanMix.left} C${sig.leanMix.center} R${sig.leanMix.right}` : "";
  const scores = sig ? `C${pct(sig.coverage)} B${pct(sig.balance)} P${pct(sig.prominence)} S${pct(sig.skew)} R${pct(sig.recency)}` : "";
  const cat = `${s.category}${s.secondaryCategory ? `/${s.secondaryCategory}` : ""}`;
  return `${i != null ? `${i}.` : "-"} [${s.headlineIndex.toFixed(3)}] ${s.title} (${cat}) | ${mix} | ${scores} | ${arts.length} arts: ${outlets.join(", ")}`;
}

function reviewLine(r: RunReview["stories"][string] | undefined): string | null {
  if (!r || (!r.verdicts.length && !r.note)) return null;
  const v = r.verdicts.map((x) => VERDICT_LABEL[x]).join(", ");
  const extra = [r.mergeWith ? `merge with: ${r.mergeWith}` : "", r.category ? `should be: ${r.category}` : "", r.note ? `note: ${r.note}` : ""]
    .filter(Boolean)
    .join("; ");
  return `   ↳ REVIEW: ${v}${extra ? ` — ${extra}` : ""}`;
}

/** Compact plain-text report meant to be pasted to Claude. */
export function buildReport(bundle: StoryBundle, usage: UsageEntry[], review: RunReview, warnings: string[], topN = 25): string {
  const articles = new Map(bundle.articles.map((a) => [a.id, a]));
  const sources = new Map(bundle.sources.map((s) => [s.id, s]));
  const ranked = bundle.stories.filter((s) => s.ranked);
  const unranked = bundle.stories.filter((s) => !s.ranked);
  const health = Object.entries(bundle.sourceHealth);
  const failed = health.filter(([, h]) => !h.ok);
  const stage = (name: string) => {
    const u = usage.filter((x) => x.stage === name);
    const ms = u.reduce((a, x) => a + x.ms, 0);
    const cost = u.reduce((a, x) => a + (x.costUsd ?? 0), 0);
    const tin = u.reduce((a, x) => a + (x.inputTokens ?? 0), 0);
    const tout = u.reduce((a, x) => a + (x.outputTokens ?? 0), 0);
    return `${name} ${(ms / 1000).toFixed(0)}s${tin ? ` ${tin} in/${tout} out $${cost.toFixed(3)}` : ""}`;
  };
  const typeCounts: Record<string, number> = {};
  for (const a of bundle.articles) if (a.articleType) typeCounts[a.articleType] = (typeCounts[a.articleType] ?? 0) + 1;

  const lines: string[] = [];
  lines.push(`# Review: run ${bundle.runId}`);
  lines.push(`window ${bundle.window.start.slice(0, 16)}→${bundle.window.end.slice(0, 16)}Z | methods ${Object.entries(bundle.methods).map(([k, v]) => `${k}=${v}`).join(" ")}`);
  lines.push(
    `sources ok ${health.length - failed.length}/${health.length}` +
      (failed.length ? ` | failed: ${failed.map(([id, h]) => `${sources.get(id)?.name ?? id} (${h.error ?? "?"})`).join("; ")}` : ""),
  );
  lines.push(`articles/source: ${health.map(([id, h]) => `${id} ${h.inWindow}`).join(", ")}`);
  lines.push(
    `articles ${bundle.articles.length} (clustered types: ${Object.entries(typeCounts).map(([k, v]) => `${k} ${v}`).join(", ")}) | ` +
      `stories ${bundle.stories.length}, ranked ${ranked.length} | cluster warnings ${warnings.length}`,
  );
  lines.push(`stages: ${["fetch", "cluster", "rank"].map(stage).join(" | ")} | total $${usage.reduce((a, x) => a + (x.costUsd ?? 0), 0).toFixed(3)}`);
  lines.push("");
  lines.push(`## My verdict`);
  lines.push(`overall match to today's real headlines: ${review.overall ? `${review.overall}/5` : "not rated"}`);
  if (review.missing.trim()) lines.push(`missing/underranked: ${review.missing.trim()}`);
  if (review.notes.trim()) lines.push(`notes: ${review.notes.trim()}`);
  lines.push("");
  lines.push(`## Ranked stories (top ${Math.min(topN, ranked.length)} of ${ranked.length}) — [index] title (cat) | lean mix | scores % | outlets`);
  ranked.forEach((s, i) => {
    const r = reviewLine(review.stories[s.id]);
    if (i < topN || r) {
      lines.push(storyLine(s, i + 1, articles, sources));
      if (r) lines.push(r);
    }
  });
  const flagged = unranked.filter((s) => review.shouldRank.includes(s.id));
  if (flagged.length) {
    lines.push("");
    lines.push(`## Below the outlet minimum but should be ranked`);
    for (const s of flagged) lines.push(storyLine(s, null, articles, sources));
  }
  if (warnings.length) {
    lines.push("");
    lines.push(`## Cluster warnings (first 10)`);
    for (const w of warnings.slice(0, 10)) lines.push(`- ${w}`);
  }
  return lines.join("\n");
}
