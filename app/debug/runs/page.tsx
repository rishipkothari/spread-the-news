import Link from "next/link";
import { listPaths } from "@/lib/storage";
import { readStatus } from "@/pipeline/status";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  const files = await listPaths("runs/");
  const ids = [...new Set(files.filter((p) => p.endsWith("/status.json")).map((p) => p.split("/")[1]))].sort().reverse().slice(0, 30);
  const statuses = await Promise.all(ids.map((id) => readStatus(id)));
  return (
    <main>
      <h1>Runs</h1>
      <div className="scroll">
        <table>
          <thead><tr><th>Run</th><th>State</th><th>Stages</th><th>Top story</th></tr></thead>
          <tbody>
            {statuses.map((s, i) => s && (
              <tr key={ids[i]}>
                <td className="mono"><Link href={`/debug/runs/${s.runId}`}>{s.runId}</Link>{s.replayFrom && <div className="muted">replay of {s.replayFrom}</div>}</td>
                <td className={s.state === "failed" ? "bad" : s.state === "done" ? "ok" : "warn"}>{s.state}</td>
                <td className="mono">{Object.entries(s.stages).map(([k, v]) => `${k}:${v?.state}`).join(" ")}</td>
                <td>{String(s.stages.rank?.summary?.top ?? "")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
