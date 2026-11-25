import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Article, Episode, EpisodeScript, Source, Story, StoryBundle, StorySynthesis } from "@/lib/types";
import type { VoiceOut } from "@/pipeline/phase3";

const store = new Map<string, unknown>();
vi.mock("@/lib/storage", async (orig) => {
  const real = await orig<typeof import("@/lib/storage")>();
  return {
    ...real,
    putJson: async (p: string, d: unknown) => void store.set(p, structuredClone(d)),
    getJson: async (p: string) => (store.has(p) ? structuredClone(store.get(p)) : null),
    listPaths: async (prefix: string) => [...store.keys()].filter((k) => k.startsWith(prefix)),
  };
});

const { buildNews, parsePublicStoryId } = await import("@/news/build");
const { pickForLength, sectionCards } = await import("@/news/queue");
const { dayNeighbours, publishRun, readNewsDay, readNewsIndex, readNewsStory, rebuildAllNews } = await import("@/news/store");

const src = (id: string, leanValue: number): Source => ({
  id, name: id.toUpperCase(), homepage: `https://${id}.example`, feeds: [], lean: leanValue < 0 ? "left" : leanValue > 0 ? "right" : "center", leanValue,
  leanProvenance: { source: "allsides", checkedOn: "2026-01-01" }, paywall: "none", fullTextInFeed: false, enabled: true,
});
const art = (id: string, sourceId: string, title: string, extra: Partial<Article> = {}): Article => ({
  id, sourceId, url: `https://${sourceId}.example/${id}`, title, feedCategories: [], prominence: "latest", publishedAt: "2026-11-25T10:00:00Z", articleType: "news", ...extra,
});
const story = (id: string, title: string, category: Story["category"], articleIds: string[], ranked = true): Story => ({ id, title, category, articleIds, headlineIndex: 1, ranked });

function bundle(runId: string, date = "2026-11-25"): StoryBundle {
  return {
    runId, createdAt: `${date}T12:00:00Z`, window: { start: `${date}T00:00:00Z`, end: `${date}T12:00:00Z` }, params: {} as StoryBundle["params"], methods: {},
    sources: [src("l1", -2), src("l2", -1), src("c1", 0), src("r1", 2)], sourceHealth: {},
    articles: [
      art("a1", "l1", "Left take on A"), art("a1b", "l1", "Left opinion on A", { articleType: "opinion" }), art("a2", "c1", "Center take on A"), art("a3", "r1", "Right take on A"),
      art("b1", "l2", "B from left"), art("b2", "c1", "B from center"),
      art("c1", "r1", "C only one outlet"),
      art("d1", "l1", "D world"), art("d2", "r1", "D world right"),
    ],
    stories: [
      story("s-a", "Story A", "us", ["a1", "a1b", "a2", "a3"]),
      story("s-b", "Story B", "business", ["b1", "b2"]),
      story("s-c", "Story C", "us", ["c1"]),
      story("s-d", "Story D", "world", ["d1", "d2"]),
      story("s-x", "Unranked", "us", ["a1", "a2"], false),
    ],
  };
}

const syntheses: StorySynthesis[] = [
  {
    storyId: "s-a", title: "Neutral A", summary: "A happened.",
    agreedFacts: [{ fact: "A is true", support: [] }],
    disputed: [
      { claim: "How many", significance: "material", positions: [{ position: "ten", sourceIds: ["l1"] }, { position: "twelve", sourceIds: ["r1", "c1"] }] },
      { claim: "Small thing", significance: "minor", positions: [] },
    ],
    framing: { left: "L frame", right: "R frame" },
  },
  { storyId: "s-d", title: "Neutral D", summary: "D.", agreedFacts: [], disputed: [], framing: {} },
];

const script = { segments: [
  { id: "welcome", kind: "welcome", text: "Hi.", words: 1 },
  { id: "seg-a", kind: "story", storyId: "s-a", text: "First paragraph.\n\nSecond paragraph.", words: 4 },
  { id: "seg-d", kind: "story", storyId: "s-d", text: "D script.", words: 2 },
  { id: "outro", kind: "outro", text: "Bye.", words: 1 },
] } as unknown as EpisodeScript;

const voice = { units: [
  { segmentId: "welcome", kind: "welcome", title: "welcome", audioKey: "kw", durationSec: 5, ms: 0 },
  { segmentId: "seg-a", kind: "story", storyId: "s-a", title: "Neutral A", audioKey: "ka", durationSec: 200, ms: 0 },
  { segmentId: "seg-d", kind: "story", storyId: "s-d", title: "Neutral D", audioKey: "", error: "tts failed", ms: 0 },
  { segmentId: "outro", kind: "outro", title: "outro", audioKey: "ko", durationSec: 4, ms: 0 },
] } as unknown as VoiceOut;

const episode = {
  id: "run1-a1", date: "2026-11-25", runId: "run1", audioPath: "episodes/run1-a1.mp3", durationSec: 210,
  chapters: [
    { segmentId: "welcome", kind: "welcome", title: "Welcome", startSec: 0, durationSec: 5 },
    { segmentId: "seg-a", kind: "story", storyId: "s-a", title: "Neutral A", startSec: 5.6, durationSec: 200 },
    { segmentId: "outro", kind: "outro", title: "Outro", startSec: 206.2, durationSec: 4 },
  ],
} as unknown as Episode;

describe("buildNews", () => {
  it("lists ranked stories with enough outlets, voiced first, with lean counts by distinct outlet", () => {
    const { day, stories } = buildNews({ bundle: bundle("run1"), syntheses, script, voice, episode }, "now");
    expect(day.stories.map((s) => s.storyId)).toEqual(["s-a", "s-b", "s-d"]); // C: one outlet; X: unranked; A voiced first
    const a = stories.find((s) => s.storyId === "s-a")!;
    expect(a.id).toBe("2026-11-25-s-a");
    expect(a.rank).toBe(1);
    expect(a.title).toBe("Neutral A");
    expect(a.outletCount).toBe(3);
    expect(a.lean).toEqual({ left: 1, center: 1, right: 1 });
    expect(a.outlets.map((o) => o.headline)).toEqual(["Left take on A", "Center take on A", "Right take on A"]); // news piece over opinion, left to right
    expect(a.script).toEqual(["First paragraph.", "Second paragraph."]);
    expect(a.hasAudio && a.durationSec).toBe(200);
    expect(a.track?.src).toBe("/audio/audio/ka.mp3");
    expect(a.analysis?.disputed).toEqual([
      { claim: "How many", positions: [{ position: "ten", sides: ["left"], outlets: ["L1"] }, { position: "twelve", sides: ["center", "right"], outlets: ["R1", "C1"] }] },
    ]);
    const d = stories.find((s) => s.storyId === "s-d")!;
    expect([d.hasAnalysis, d.hasScript, d.hasAudio]).toEqual([true, true, false]); // voicing failed
    expect(d.rank).toBe(4); // rank in the run's list, even when a story above wasn't listed
    const b = stories.find((s) => s.storyId === "s-b")!;
    expect([b.hasAnalysis, b.hasScript, b.hasAudio, b.title]).toEqual([false, false, false, "Story B"]);
    expect(day.counts).toEqual({ stories: 3, voiced: 1, bySection: { us: 1, world: 1, business: 1, science: 0, sports: 0, other: 0 } });
    expect(day.progress).toBe(3);
    expect("script" in day.stories[0]).toBe(false); // rows stay small
  });

  it("builds the episode as tracks from the segment audio", () => {
    const { day } = buildNews({ bundle: bundle("run1"), syntheses, script, voice, episode });
    expect(day.episode).toMatchObject({ id: "run1-a1", durationSec: 210, storyCount: 1, titles: ["Neutral A"], src: "/audio/episodes/run1-a1.mp3" });
    expect(day.episode!.tracks.map((t) => [t.kind, t.src])).toEqual([
      ["welcome", "/audio/audio/kw.mp3"],
      ["story", "/audio/audio/ka.mp3"],
      ["outro", "/audio/audio/ko.mp3"],
    ]);
  });

  it("progress follows what the run has done", () => {
    expect(buildNews({ bundle: bundle("r") }).day.progress).toBe(0);
    expect(buildNews({ bundle: bundle("r"), syntheses }).day.progress).toBe(1);
    expect(buildNews({ bundle: bundle("r"), syntheses, script }).day.progress).toBe(2);
  });

  it("parses public ids", () => {
    expect(parsePublicStoryId("2026-11-25-s-abc")).toEqual({ date: "2026-11-25", storyId: "s-abc" });
    expect(parsePublicStoryId("nope")).toBeNull();
  });
});

describe("queue helpers", () => {
  const card = (rank: number, sec?: number, category: Story["category"] = "us") => ({
    id: `d-${rank}`, storyId: `${rank}`, date: "d", rank, title: `${rank}`, category, outletCount: 2, lean: { left: 1, center: 0, right: 1 },
    hasAnalysis: true, hasScript: !!sec, hasAudio: !!sec, ...(sec ? { durationSec: sec, track: { id: `d-${rank}`, title: `${rank}`, kind: "story" as const, durationSec: sec, src: `/a/${rank}` } } : {}),
  });

  it("fills the length in rank order, skipping a story that runs too far over", () => {
    const cards = [card(1, 200), card(2, 200), card(3), card(4, 300), card(5, 150)];
    expect(pickForLength(cards, 10, 45).map((t) => t.id)).toEqual(["d-1", "d-2", "d-5"]); // 400 + 300 > 645 → skip 4; +150 = 550
    expect(pickForLength(cards, 5, 45).map((t) => t.id)).toEqual(["d-1"]); // 400 and 350 both run more than 45 s past 300
    expect(pickForLength([card(1, 900)], 5, 45).map((t) => t.id)).toEqual(["d-1"]); // always at least one
    expect(pickForLength([card(1)], 5)).toEqual([]);
  });

  it("filters a section", () => {
    expect(sectionCards([card(1, 1, "us"), card(2, 1, "world")], "world").map((c) => c.rank)).toEqual([2]);
  });
});

describe("publishing", () => {
  const seedRun = (runId: string, date: string, withAudio: boolean) => {
    store.set(`runs/${runId}/bundle.json`, bundle(runId, date));
    if (withAudio) {
      store.set(`runs/${runId}/synthesize.json`, { syntheses, errors: [] });
      store.set(`runs/${runId}/script.json`, script);
      store.set(`runs/${runId}/voice.json`, voice);
      store.set(`runs/${runId}/assemble.json`, { episodeId: `${runId}-a1` });
      store.set(`episodes/${runId}-a1.json`, { ...episode, id: `${runId}-a1`, audioPath: `episodes/${runId}-a1.mp3` });
    }
  };
  beforeEach(() => store.clear());

  it("writes the day, its stories and the index", async () => {
    seedRun("run1", "2026-11-25", true);
    const r = await publishRun("run1");
    expect(r).toMatchObject({ published: true, date: "2026-11-25", stories: 3, voiced: 1 });
    expect((await readNewsDay("2026-11-25"))?.runId).toBe("run1");
    expect((await readNewsStory("2026-11-25-s-a"))?.script).toHaveLength(2);
    expect((await readNewsIndex()).days).toMatchObject([{ date: "2026-11-25", runId: "run1", stories: 3, voiced: 1, hasEpisode: true }]);
  });

  it("a later run with less done doesn't replace a voiced day unless forced", async () => {
    seedRun("run1", "2026-11-25", true);
    seedRun("run2", "2026-11-25", false);
    await publishRun("run1");
    expect(await publishRun("run2")).toMatchObject({ published: false });
    expect((await readNewsDay("2026-11-25"))?.runId).toBe("run1");
    expect(await publishRun("run2", { force: true })).toMatchObject({ published: true, note: "replaced run run1" });
    expect((await readNewsDay("2026-11-25"))?.runId).toBe("run2");
  });

  it("rebuilds every day, newest first in the index, and finds neighbours", async () => {
    seedRun("2026-11-24T0100-a", "2026-11-24", false);
    seedRun("2026-11-25T0100-a", "2026-11-25", true);
    seedRun("2026-11-25T0900-b", "2026-11-25", false); // newer but less done: run a stays
    seedRun("2026-11-22T0100-a", "2026-11-22", false);
    await rebuildAllNews();
    const index = await readNewsIndex();
    expect(index.days.map((d) => [d.date, d.runId])).toEqual([
      ["2026-11-25", "2026-11-25T0100-a"],
      ["2026-11-24", "2026-11-24T0100-a"],
      ["2026-11-22", "2026-11-22T0100-a"],
    ]);
    expect(dayNeighbours(index, "2026-11-24")).toEqual({ older: "2026-11-22", newer: "2026-11-25" });
    expect(dayNeighbours(index, "2026-11-23")).toEqual({ older: "2026-11-22", newer: "2026-11-24" });
    expect(dayNeighbours(index, "2026-11-25")).toEqual({ older: "2026-11-24", newer: undefined });
  });
});
