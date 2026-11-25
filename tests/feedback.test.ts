import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// In-memory Blob.
const store = new Map<string, unknown>();
vi.mock("@/lib/storage", async (orig) => {
  const real = await orig<typeof import("@/lib/storage")>();
  return {
    ...real,
    putJson: async (p: string, d: unknown) => void store.set(p, structuredClone(d)),
    getJson: async (p: string) => (store.has(p) ? structuredClone(store.get(p)) : null),
  };
});

import { basicAuthOk } from "@/lib/auth";
import { chunkText, clockLabel, feedbackBody, labelsFor, locateMoment, sentences } from "@/feedback/format";
import { momentContext } from "@/feedback/moment";
import { sendFeedback } from "@/feedback/send";

type Call = { method: string; url: string; body?: Record<string, unknown> };

/** Fake GitHub: records calls, numbers issues from 1, and lets a test close an issue. */
function fakeGithub() {
  const calls: Call[] = [];
  const issues = new Map<number, { state: "open" | "closed" }>();
  let next = 1;
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, url, body });
    const path = url.replace(/^https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+/, "");
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
    if (method === "POST" && path === "/labels") return json({ message: "already_exists" }, 422);
    if (method === "POST" && path === "/issues") {
      const n = next++;
      issues.set(n, { state: "open" });
      return json({ number: n, html_url: `https://github.com/x/y/issues/${n}`, state: "open", labels: body.labels.map((name: string) => ({ name })) }, 201);
    }
    const m = path.match(/^\/issues\/(\d+)(\/comments|\/labels)?$/);
    if (m) {
      const n = +m[1];
      if (m[2] === "/comments") return json({ html_url: `https://github.com/x/y/issues/${n}#c${calls.length}` }, 201);
      if (m[2] === "/labels") return json([]);
      return json({ number: n, html_url: `https://github.com/x/y/issues/${n}`, state: issues.get(n)?.state ?? "open", labels: [] });
    }
    return json({ message: "not found" }, 404);
  });
  return { calls, issues, fetchMock };
}

describe("feedback text", () => {
  it("labels by area", () => {
    expect(labelsFor("script")).toEqual(["feedback", "feedback:script"]);
  });

  it("puts note, report and data in the body", () => {
    const body = feedbackBody({ area: "script", title: "t", note: "  too long  ", report: "# Report\nline", data: { runId: "r1" }, page: "/debug/runs/r1/script" }, "2026-11-25T00:00:00Z");
    expect(body).toContain("**Area:** script");
    expect(body).toContain("`/debug/runs/r1/script`");
    expect(body).toContain("### Note\n\ntoo long");
    expect(body).toContain("### Report\n\n# Report\nline");
    expect(body).toContain('"runId": "r1"');
    expect(body).not.toMatch(/\n{3,}/);
  });

  it("leaves out empty sections", () => {
    const body = feedbackBody({ area: "general", title: "t", note: "hi" }, "now");
    expect(body).not.toContain("### Report");
    expect(body).not.toContain("<details>");
  });

  it("splits long text at line breaks and numbers the parts", () => {
    const text = Array.from({ length: 300 }, (_, i) => `line ${i} ${"x".repeat(40)}`).join("\n");
    const parts = chunkText(text, 2000);
    expect(parts.length).toBeGreaterThan(5);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(2000 + 30);
    expect(parts[0]).toMatch(/_\(part 1 of \d+\)_$/);
    expect(parts.map((p) => p.replace(/\n\n_\(part \d+ of \d+\)_$/, "")).join("\n")).toBe(text);
    expect(chunkText("short")).toEqual(["short"]);
  });

  it("formats clock labels", () => {
    expect(clockLabel(75.4)).toBe("1:15");
    expect(clockLabel(5)).toBe("0:05");
  });
});

describe("locateMoment", () => {
  const text = "First sentence here. Second one is “quoted.” Third sentence is the last.";
  it("splits sentences, keeping closing quotes", () => {
    expect(sentences(text)).toEqual(["First sentence here.", "Second one is “quoted.”", "Third sentence is the last."]);
  });
  it("finds the sentence by share of the duration", () => {
    expect(locateMoment(text, 0, 30)?.sentence).toBe("First sentence here.");
    expect(locateMoment(text, 15, 30)?.sentence).toBe("Second one is “quoted.”");
    expect(locateMoment(text, 29, 30)).toMatchObject({ index: 2, before: "Second one is “quoted.”", after: undefined });
    expect(locateMoment(text, 99, 30)?.index).toBe(2);
    expect(locateMoment("", 1, 2)).toBeNull();
  });
});

describe("sendFeedback", () => {
  let gh: ReturnType<typeof fakeGithub>;
  beforeEach(() => {
    store.clear();
    gh = fakeGithub();
    vi.stubGlobal("fetch", gh.fetchMock);
    process.env.GITHUB_FEEDBACK_TOKEN = "test-token";
  });
  afterEach(() => vi.unstubAllGlobals());

  it("creates a labelled issue and logs it", async () => {
    const r = await sendFeedback({ area: "analysis", key: "analysis:r1:vcurrent", title: "Analysis review r1", report: "report" });
    expect(r).toEqual({ url: "https://github.com/x/y/issues/1", issue: 1, updated: false });
    const create = gh.calls.find((c) => c.method === "POST" && c.url.endsWith("/issues"))!;
    expect(create.url).toContain("api.github.com/repos/rishipkothari/spread-the-news/issues");
    expect(create.body).toMatchObject({ title: "Analysis review r1", labels: ["feedback", "feedback:analysis"] });
    expect(store.get("feedback/threads.json")).toEqual({ "analysis:r1:vcurrent": { issue: 1, url: "https://github.com/x/y/issues/1" } });
    expect([...store.keys()].some((k) => k.startsWith("feedback/log/"))).toBe(true);
  });

  it("adds a comment when the same key's issue is still open", async () => {
    await sendFeedback({ area: "script", key: "k", title: "Script review", report: "v1" });
    const r = await sendFeedback({ area: "script", key: "k", title: "Script review", report: "v2" });
    expect(r.updated).toBe(true);
    expect(r.issue).toBe(1);
    expect(gh.calls.filter((c) => c.url.endsWith("/issues") && c.method === "POST")).toHaveLength(1);
    const comment = gh.calls.find((c) => c.url.endsWith("/issues/1/comments"))!;
    expect(String(comment.body?.body)).toContain("**Updated:** Script review");
  });

  it("opens a new issue once the old one is closed", async () => {
    await sendFeedback({ area: "script", key: "k", title: "a", report: "v1" });
    gh.issues.set(1, { state: "closed" });
    const r = await sendFeedback({ area: "script", key: "k", title: "a", report: "v2" });
    expect(r).toMatchObject({ issue: 2, updated: false });
    expect((store.get("feedback/threads.json") as Record<string, { issue: number }>).k.issue).toBe(2);
  });

  it("without a key, every send is a new issue", async () => {
    await sendFeedback({ area: "general", title: "a", note: "one" });
    const r = await sendFeedback({ area: "general", title: "b", note: "two" });
    expect(r.issue).toBe(2);
  });

  it("posts overflow as comments", async () => {
    const report = Array.from({ length: 3000 }, (_, i) => `row ${i} ${"y".repeat(40)}`).join("\n");
    await sendFeedback({ area: "analysis", title: "big", report });
    expect(gh.calls.filter((c) => c.url.endsWith("/issues/1/comments")).length).toBeGreaterThanOrEqual(1);
  });

  it("explains a bad token", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Bad credentials", { status: 401 })));
    await expect(sendFeedback({ area: "general", title: "a", note: "x" })).rejects.toThrow(/token wrong or expired/);
  });

  it("explains a missing token", async () => {
    delete process.env.GITHUB_FEEDBACK_TOKEN;
    await expect(sendFeedback({ area: "general", title: "a", note: "x" })).rejects.toThrow(/GITHUB_FEEDBACK_TOKEN/);
  });
});

describe("momentContext", () => {
  beforeEach(() => store.clear());

  it("finds a story track's script", async () => {
    store.set("news/stories/2026-11-25-s1.json", { date: "2026-11-25", runId: "r1", storyId: "s1", script: ["One. Two.", "Three."] });
    const ctx = await momentContext({ id: "2026-11-25-s1", title: "T", kind: "story", storyId: "2026-11-25-s1", src: "/a.mp3", durationSec: 30 }, 29, 30);
    expect(ctx).toMatchObject({ date: "2026-11-25", runId: "r1", segmentId: "seg-s1" });
    expect(ctx.located?.sentence).toBe("Three.");
  });

  it("finds a template track's text through the episode and script", async () => {
    store.set("episodes/r1-a1.json", { id: "r1-a1", date: "2026-11-25", runId: "r1" });
    store.set("runs/r1/script.json", { segments: [{ id: "seg-welcome", kind: "welcome", text: "This is Spread the News, where we read across the spectrum." }] });
    const ctx = await momentContext({ id: "r1-a1:seg-welcome", title: "Welcome", kind: "welcome", src: "/a.mp3", durationSec: 5 }, 2, 5);
    expect(ctx.segmentId).toBe("seg-welcome");
    expect(ctx.located?.sentence).toContain("we read across");
  });

  it("returns nothing when the data is missing", async () => {
    expect(await momentContext({ id: "x:y", title: "", kind: "outro", src: "", durationSec: 1 }, 0, 1)).toEqual({ date: undefined, runId: undefined, segmentId: "y", text: undefined });
  });
});

describe("basicAuthOk", () => {
  it("accepts the player password with any username", () => {
    process.env.PLAYER_PASSWORD = "pw";
    expect(basicAuthOk(`Basic ${Buffer.from("me:pw").toString("base64")}`)).toBe(true);
    expect(basicAuthOk(`Basic ${Buffer.from("me:nope").toString("base64")}`)).toBe(false);
    expect(basicAuthOk(null)).toBe(false);
  });
});
