import { getJson, paths, putJson } from "@/lib/storage";
import type { RunParams, UsageEntry } from "@/lib/types";
import type { StageId } from "./stages";

export type StageState = "pending" | "running" | "done" | "failed" | "skipped" | "copied";

export interface StageStatus {
  state: StageState;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  summary?: Record<string, unknown>;
}

export interface RunStatus {
  runId: string;
  createdAt: string;
  updatedAt: string;
  state: "queued" | "running" | "done" | "failed";
  params: RunParams;
  methods: Record<string, string>;
  replayFrom?: string;
  workflowRunId?: string;
  stages: Partial<Record<StageId, StageStatus>>;
  errors: string[];
}

export async function readStatus(runId: string): Promise<RunStatus | null> {
  return getJson<RunStatus>(paths.status(runId));
}

export async function writeStatus(status: RunStatus): Promise<void> {
  status.updatedAt = new Date().toISOString();
  await putJson(paths.status(status.runId), status);
}

export async function updateStatus(runId: string, fn: (s: RunStatus) => void): Promise<RunStatus> {
  const s = await readStatus(runId);
  if (!s) throw new Error(`run ${runId} not found`);
  fn(s);
  await writeStatus(s);
  return s;
}

export async function appendUsage(runId: string, entries: UsageEntry[]): Promise<void> {
  if (!entries.length) return;
  const existing = (await getJson<UsageEntry[]>(paths.usage(runId))) ?? [];
  await putJson(paths.usage(runId), [...existing, ...entries]);
}
