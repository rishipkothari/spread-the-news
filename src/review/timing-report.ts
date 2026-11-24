import type { UsageEntry } from "@/lib/types";
import { STAGES, isFanout } from "@/pipeline/stages";
import { stageWallMs, type RunStatus } from "@/pipeline/status";

const secs = (ms: number) => (ms >= 60_000 ? `${Math.floor(ms / 60_000)}m${Math.round((ms % 60_000) / 1000)}s` : `${(ms / 1000).toFixed(1)}s`);

/** Plain-text time and cost per step of a run, to paste to Claude (the "measure each step" check). */
export function buildTimingReport(
  status: RunStatus,
  usage: UsageEntry[],
  context: { sources?: number; okSources?: number; articles?: number; stories?: number } = {},
): string {
  const lines = [`# Time and cost: run ${status.runId}`];
  const ctx = [
    context.okSources != null && context.sources != null ? `sources ok ${context.okSources}/${context.sources}` : "",
    context.articles != null ? `articles ${context.articles}` : "",
    context.stories != null ? `stories ${context.stories}` : "",
  ].filter(Boolean);
  if (ctx.length) lines.push(ctx.join(" | "));
  lines.push("step | state | elapsed | step time (parallel steps summed) | tokens in/out | cost | result");
  let total = 0;
  let totalMs = 0;
  for (const stage of STAGES) {
    const st = status.stages[stage];
    if (!st || st.state === "skipped" || st.state === "pending") continue;
    const u = usage.filter((x) => x.stage === stage);
    const wall = stageWallMs(st);
    const step = u.reduce((a, x) => a + x.ms, 0);
    const tin = u.reduce((a, x) => a + (x.inputTokens ?? 0), 0);
    const tout = u.reduce((a, x) => a + (x.outputTokens ?? 0), 0);
    const cost = u.reduce((a, x) => a + (x.costUsd ?? 0), 0);
    total += cost;
    totalMs += wall ?? step;
    const result = st.error ? `ERROR ${st.error}` : st.summary ? Object.entries(st.summary).map(([k, v]) => `${k} ${v}`).join(", ") : "";
    lines.push(
      [stage, st.state, wall != null ? secs(wall) : "–", isFanout(stage) && step ? secs(step) : "", tin ? `${tin}/${tout}` : "", cost ? `$${cost.toFixed(4)}` : "", result].join(" | "),
    );
  }
  lines.push(`total: ${secs(totalMs)} elapsed (waiting between phases not counted), $${total.toFixed(3)}`);
  return lines.join("\n");
}
