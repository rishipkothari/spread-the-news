import { getJson, putJson } from "@/lib/storage";
import { chunkText, feedbackBody, labelsFor, type FeedbackInput } from "./format";
import { addComment, addLabels, createIssue, ensureLabels, getIssue } from "./github";

/**
 * Sends feedback to Claude as a GitHub issue. Sends that share a `key` while the issue is open become comments on it,
 * so one run's script review stays one thread. Every send is also logged to Blob (feedback/log/).
 */

const THREADS = "feedback/threads.json";
type Threads = Record<string, { issue: number; url: string }>;

export interface SendResult {
  url: string;
  issue: number;
  /** true when added as a comment to an open issue. */
  updated: boolean;
}

export async function sendFeedback(input: FeedbackInput): Promise<SendResult> {
  const sentAt = new Date().toISOString();
  const parts = chunkText(feedbackBody(input, sentAt));
  const labels = labelsFor(input.area);
  const threads = input.key ? ((await getJson<Threads>(THREADS)) ?? {}) : {};
  const existing = input.key ? threads[input.key] : undefined;

  let result: SendResult | null = null;
  if (existing) {
    const issue = await getIssue(existing.issue).catch(() => null);
    if (issue?.state === "open") {
      let url = issue.html_url;
      for (const [i, part] of parts.entries()) {
        const c = await addComment(issue.number, i === 0 ? `**Updated:** ${input.title}\n\n${part}` : part);
        if (i === 0) url = c.html_url;
      }
      result = { url, issue: issue.number, updated: true };
    }
  }

  if (!result) {
    await ensureLabels(labels);
    const issue = await createIssue(input.title.slice(0, 200), parts[0], labels);
    // Labels are dropped silently if the token may not set them on create; add them explicitly then.
    const got = new Set(issue.labels.map((l) => (typeof l === "string" ? l : l.name)));
    if (labels.some((l) => !got.has(l))) await addLabels(issue.number, labels).catch(() => undefined);
    for (const part of parts.slice(1)) await addComment(issue.number, part);
    result = { url: issue.html_url, issue: issue.number, updated: false };
    if (input.key) {
      threads[input.key] = { issue: issue.number, url: issue.html_url };
      await putJson(THREADS, threads);
    }
  }

  await putJson(`feedback/log/${sentAt.replace(/[:.]/g, "-")}-${input.area}.json`, { ...input, sentAt, ...result }).catch(() => undefined);
  return result;
}
