import Link from "next/link";
import { listPaths } from "@/lib/storage";
import { readStatus } from "@/pipeline/status";
import { missingEnv } from "@/lib/env";
import { replayAction, startRunAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  const files = await listPaths("runs/");
  const ids = [...new Set(files.filter((p) => p.endsWith("/status.json")).map((p) => p.split("/")[1]))].sort().reverse().slice(0, 30);
  const statuses = await Promise.all(ids.map((id) => readStatus(id)));
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
          <input type="hidden" name="mode" value="full" />
          <button type="submit">Start full run (uses Claude, ~$0.10–0.30)</button>
        </form>
      </div>
      <div className="scroll">
        <table>
          <thead><tr><th>Run</th><th>State</th><th>Stages</th><th>Top story</th><th></th></tr></thead>
          <tbody>
            {statuses.map((s, i) => s && (
              <tr key={ids[i]}>
                <td className="mono"><Link href={`/debug/runs/${s.runId}`}>{s.runId}</Link>{s.replayFrom && <div className="muted">replay of {s.replayFrom}</div>}</td>
                <td className={s.state === "failed" ? "bad" : s.state === "done" ? "ok" : "warn"}>{s.state}</td>
                <td className="mono">{Object.entries(s.stages).map(([k, v]) => `${k}:${v?.state}`).join(" ")}</td>
                <td>{String(s.stages.rank?.summary?.top ?? "")}</td>
                <td>
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
