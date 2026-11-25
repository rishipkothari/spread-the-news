import { config } from "@/lib/config";

/**
 * Minimal GitHub REST client for feedback issues. Token: GITHUB_FEEDBACK_TOKEN, a fine-grained token limited to this
 * repo with Issues read and write. Repo: config/pipeline.json → feedback.repo.
 */

export class GithubError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export function feedbackConfigured(): boolean {
  return !!process.env.GITHUB_FEEDBACK_TOKEN;
}

async function gh<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = process.env.GITHUB_FEEDBACK_TOKEN;
  if (!token) throw new GithubError("GITHUB_FEEDBACK_TOKEN is not set in Vercel's environment variables", 0);
  const res = await fetch(`https://api.github.com/repos/${config.feedback.repo}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "content-type": "application/json",
      "user-agent": "prism-news-feedback",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = (await res.text().catch(() => "")).slice(0, 300);
    const hint = res.status === 401 ? " (token wrong or expired: make a new one and update GITHUB_FEEDBACK_TOKEN)"
      : res.status === 403 || res.status === 404 ? " (token can't reach the repo: check it has this repository and Issues: Read and write)" : "";
    throw new GithubError(`GitHub ${method} ${path} → ${res.status}${hint}: ${text}`, res.status);
  }
  return (await res.json()) as T;
}

export interface Issue {
  number: number;
  html_url: string;
  state: "open" | "closed";
  labels: ({ name: string } | string)[];
}

const knownLabels = new Set<string>();

/** Creates labels that don't exist yet (422 = already there). */
export async function ensureLabels(names: string[]): Promise<void> {
  for (const name of names) {
    if (knownLabels.has(name)) continue;
    try {
      await gh("POST", "/labels", { name, color: name === "feedback" ? "6f42c1" : "d4c5f9", description: "Sent from the PRISM News site" });
    } catch (e) {
      if (!(e instanceof GithubError && e.status === 422)) throw e;
    }
    knownLabels.add(name);
  }
}

export const createIssue = (title: string, body: string, labels: string[]) => gh<Issue>("POST", "/issues", { title, body, labels });
export const getIssue = (n: number) => gh<Issue>("GET", `/issues/${n}`);
export const addComment = (n: number, body: string) => gh<{ html_url: string }>("POST", `/issues/${n}/comments`, { body });
export const addLabels = (n: number, labels: string[]) => gh<unknown>("POST", `/issues/${n}/labels`, { labels });
