import Link from "next/link";
import { listRunIds } from "@/lib/storage";
import { readStatus } from "@/pipeline/status";
import { STAGES } from "@/pipeline/stages";
import { missingEnv } from "@/lib/env";
import { replayAction, startRunAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  const ids = (await listRunIds()).slice(0, 30);
  const statuses = await Promise.all(ids.map((id) => readStatus(id).catch(() => null)));
  return (
    <main>
      <h1>Runs</h1>
      {missingEnv().length > 0 && <p className="bad">Missing environment variables: {missingEnv().join(", ")}</p>}
      <div className="row" style={{ margin: "12px 0 20px" }}>
        <form action={startRunAction}>
          <input type="hidden" name="mode" value="fetch-only" />
          <button type="submit">Check feeds (free)</button>
        </form>
        <form action={startRunAction}>
              <input type="hidden" name="mode" value="create" />
              <button type="submit" title="Make a new run without starting it. Its page lets you find stories or run everything.">Create run</button>
            </form>
            <form action={startRunAction}>
              <input type="hidden" name="mode" value="everything" />
              <button type="submit" className="primary" title="Find stories, analyze, write the script and make the audio in one go (uses Claude)">Run full pipeline (~$0.60–1.00)</button>
            </form>
      </div>
      <div className="scroll">
        <table>
          <thead><tr><th>Run</th><th>State</th>{STAGES.map((st) => <th key={st}>{st}</th>)}<th>Top story</th><th></th></tr></thead>
          <tbody>
            {statuses.map((s, i) => s && (
              <tr key={ids[i]}>
                <td className="mono"><Link href={`/debug/runs/${s.runId}`}>{s.runId}</Link>{s.replayFrom && <div className="muted">replay of {s.replayFrom}</div>}</td>
                <td className={s.state === "failed" ? "bad" : s.state === "done" ? "ok" : "warn"}>{s.state}</td>
                {STAGES.map((st) => {
                  const v = s.stages[st]?.state;
                  return (
                    <td key={st} className={v === "failed" ? "bad" : v === "done" ? "ok" : v === "running" || v === "pending" ? "warn" : "muted"} style={{ fontSize: 12 }}>
                      {v === "done" ? "✓" : v === "skipped" || !v ? "–" : v}
                    </td>
                  );
                })}
                <td>{String(s.stages.rank?.summary?.top ?? "")}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {s.stages.rank?.state === "done" && <Link href={`/debug/runs/${s.runId}/review`} style={{ marginRight: 8 }}>Review</Link>}
                  {(s.stages.fetch?.state === "done" || s.stages.fetch?.state === "copied") && (
                    <form action={replayAction}>
                      <input type="hidden" name="runId" value={s.runId} />
                      <input type="hidden" name="from" value="cluster" />
                      <button type="submit">Re-cluster</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
