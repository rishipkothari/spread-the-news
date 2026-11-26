import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EpisodeScript, Segment } from "@/lib/types";
import type { TTSProvider } from "@/stages/types";

// In-memory Blob.
const store = new Map<string, unknown>();
vi.mock("@/lib/storage", async (orig) => {
  const real = await orig<typeof import("@/lib/storage")>();
  return {
    ...real,
    putJson: async (p: string, d: unknown) => void store.set(p, structuredClone(d)),
    getJson: async (p: string) => (store.has(p) ? structuredClone(store.get(p)) : null),
    listPaths: async (prefix: string) => [...store.keys()].filter((k) => k.startsWith(prefix)),
    putBytes: async (p: string, d: Uint8Array) => void store.set(p, new Uint8Array(d)),
    getBytes: async (p: string) => (store.get(p) instanceof Uint8Array ? new Uint8Array(store.get(p) as Uint8Array) : null),
    sizeOf: async (p: string) => (store.get(p) instanceof Uint8Array ? (store.get(p) as Uint8Array).length : null),
  };
});

// Claude's reply is set per test; null makes the call fail.
let claudeReply: { edits: { segment: string; find: string; replace: string; kind: string; why: string }[] } | null = null;
const llmInputs: string[] = [];
vi.mock("@/lib/llm", async (orig) => {
  const real = await orig<typeof import("@/lib/llm")>();
  return {
    ...real,
    structuredCall: async (opts: { user: string }) => {
      llmInputs.push(opts.user);
      if (!claudeReply) throw new real.LlmOutputError("structured output failed after retry: test");
      return { data: claudeReply, usage: [{ model: "claude-sonnet-5-5", inputTokens: 100, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0.0004 }] };
    },
  };
});

const voiced: string[] = [];
vi.mock("@/stages/tts", async (orig) => {
  const real = await orig<typeof import("@/stages/tts")>();
  const { stubTts } = await import("@/stages/tts/stub");
  const counting: TTSProvider = { id: "counting", format: stubTts.format, voices: stubTts.voices, async synthesize(text, voice) { voiced.push(text); return stubTts.synthesize(text, voice); } };
  return { ...real, ttsProviders: { ...real.ttsProviders, counting } };
});

const { applyRules, applyClaudeEdits, editProblem } = await import("@/audio/spoken");
const { combine, buildSpeakUser } = await import("@/stages/speak/sonnet-spoken-v1");
const { runStage } = await import("@/pipeline/run");
const { readSpoken } = await import("@/pipeline/speak");
const phase3 = await import("@/pipeline/phase3");
const { paths } = await import("@/lib/storage");
const { config, vanillaParams } = await import("@/lib/config");
const { AUDIO_STAGES } = await import("@/pipeline/stages");

describe("code rules", () => {
  const r = (t: string) => applyRules(t).text;
  it("writes out units and symbols", () => {
    expect(r("It hit 104°F with 60 mph winds as the Fed cut rates 25 bps to 4.5%.")).toBe(
      "It hit 104 degrees Fahrenheit with 60 miles per hour winds as the Fed cut rates 25 basis points to 4.5 percent.",
    );
  });
  it("writes money shorthand with a plural \"dollars\"", () => {
    expect(r("The bill costs $1.2B over 10 years.")).toBe("The bill costs 1.2 billion dollars over 10 years.");
    expect(r("a $3 billion fund and $450M in aid")).toBe("a 3 billion dollars fund and 450 million dollars in aid");
    expect(r("It costs $5.")).toBe("It costs $5.");
  });
  it("writes zones, months, titles and party labels", () => {
    expect(r("Polls close at 8 p.m. ET on Nov. 4.")).toBe("Polls close at 8 p.m. Eastern on November 4.");
    expect(r("Sen. John Cornyn, R-Texas, voted against the bill.")).toBe("Senator John Cornyn, Republican of Texas, voted against the bill.");
    expect(r("said Rep. Ro Khanna, D-Calif. He added more.")).toBe("said Representative Ro Khanna, Democrat of California. He added more.");
    expect(r("Lt. Gov. Smith and Gov. Newsom")).toBe("Lieutenant Governor Smith and Governor Newsom");
  });
  it("leaves what the voice reads right alone", () => {
    for (const t of ["Flooding hit St. Louis overnight.", "The US economy grew.", "The Senate voted 52-48 to extend the 9/11 fund.", "Officials had no Plan B.", "The case could revisit Roe v. Wade.", "AT&T raised prices and/or fees — again… for the third time."]) {
      expect(r(t)).toBe(t);
    }
  });
  it("spells WHO as letters and strips accents", () => {
    expect(r("WHO officials warned. Who knows?")).toBe("W.H.O. officials warned. Who knows?");
    expect(r("Protesters in São Paulo called it a coup d'état. Erdoğan met Müller.")).toBe("Protesters in Sao Paulo called it a coup d'etat. Erdogan met Muller.");
  });
  it("lists each change once", () => {
    const { edits } = applyRules("Sen. A and Sen. B");
    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({ find: "Sen. ", replace: "Senator ", by: "rule" });
  });
});

describe("checks on Claude's edits", () => {
  const text = "Inspectors found lead in the water. The US and NATO responded. Claudia Sheinbaum spoke.";
  it("accepts lowercase respellings and commas", () => {
    expect(editProblem({ find: "found lead", replace: "found led" }, text)).toBeNull();
    expect(editProblem({ find: "Sheinbaum", replace: "Shane-bowm" }, text)).toBeNull();
    expect(editProblem({ find: "WHO", replace: "W.H.O." }, "WHO said")).toBeNull();
  });
  it("refuses capitals inside a respelling, markup, missing text and words read right", () => {
    expect(editProblem({ find: "Sheinbaum", replace: "SHANE-bowm" }, text)).toMatch(/capitals/);
    expect(editProblem({ find: "lead", replace: "le-AD" }, text)).toMatch(/capitals/);
    expect(editProblem({ find: "lead", replace: '<phoneme ph="lɛd">lead</phoneme>' }, text)).toMatch(/markup/);
    expect(editProblem({ find: "Zelenskyy", replace: "Zelensky" }, text)).toMatch(/isn't in/);
    expect(editProblem({ find: "The US and", replace: "The U-S and" }, text)).toMatch(/read right/);
    expect(editProblem({ find: "NATO", replace: "Nay-toe" }, text)).toMatch(/read right/);
  });
  it("applies good edits to every occurrence and keeps refused ones for the page", () => {
    const r = applyClaudeEdits("SHE voted no. SHE said so.", [
      { find: "SHE", replace: "she", kind: "caps", why: "caps spelled out" },
      { find: "no", replace: "NO", kind: "caps", why: "bad" },
    ]);
    expect(r.text).toBe("she voted no. she said so.");
    expect(r.applied).toHaveLength(1);
    expect(r.rejected[0].reason).toMatch(/capitals/);
  });
});

describe("combine", () => {
  const segments = [
    { id: "w", kind: "welcome", text: "This is Spread the News, where we read across the spectrum so you don't have to." },
    { id: "s1", kind: "story", storyId: "a", text: "Engineers spent years trying to perfect the design, said Sen. Jane Roe, D-Ore." },
  ];
  it("runs rules everywhere, Claude only on non-fixed lines, and records both", () => {
    const out = combine({ segments }, {
      edits: [
        { segment: "w", find: "read", replace: "red", kind: "heteronym", why: "should not apply" },
        { segment: "s1", find: "to perfect", replace: "to pur-fect", kind: "stress", why: "verb" },
      ],
    });
    expect(out[0].spoken).toBe(segments[0].text);
    expect(out[1].spoken).toBe("Engineers spent years trying to pur-fect the design, said Senator Jane Roe, Democrat of Oregon.");
    expect(out[1].edits.map((e) => e.by)).toEqual(["rule", "rule", "claude"]);
    expect(out[1].text).toBe(segments[1].text);
  });
  it("lists segments for Claude with ids and kinds", () => {
    expect(buildSpeakUser([{ id: "s1", kind: "story", text: "Hi." }])).toContain("[s1 | story]\nHi.");
  });
});

// ---------- the stage and the voice ----------

const RUN = "2026-11-26T0900-spk001";
const seg = (id: string, kind: Segment["kind"], text: string, storyId?: string): Segment => ({ id, kind, storyId, text, scriptHash: id, words: 1, checkerResult: { pass: true, template: true } });

function seed(methods: Record<string, string> = {}) {
  store.clear();
  voiced.length = 0;
  llmInputs.length = 0;
  const params = vanillaParams();
  const segments = [
    seg("seg-welcome", "welcome", "This is Spread the News, where we read across the spectrum so you don't have to."),
    seg("seg-s1", "story", "Inspectors found lead in the water, and Sen. Ann Lee, R-Fla., asked for $1.2B.", "s1"),
  ];
  const script: EpisodeScript = { runId: RUN, date: "2026-11-26", params, segments, dropped: [], words: 0, estMinutes: 0, policy: { ok: true, reasons: [] }, errors: [] };
  store.set(paths.stage(RUN, "script"), script);
  store.set(paths.stage(RUN, "plan"), { stories: [{ storyId: "s1", title: "Water" }] });
  // A run from before the speak stage: no methods.speak saved.
  const { speak: _omit, ...older } = config.methods;
  store.set(paths.status(RUN), { runId: RUN, createdAt: "", updatedAt: "", state: "done", params, methods: { ...older, tts: "counting", ...methods }, stages: { script: { state: "done" } }, errors: [] });
}

describe("speak stage", () => {
  beforeEach(() => {
    claudeReply = { edits: [{ segment: "seg-s1", find: "found lead", replace: "found led", kind: "heteronym", why: "the metal" }] };
  });

  it("comes first in Make audio", () => {
    expect(AUDIO_STAGES[0]).toBe("speak");
  });

  it("writes speak.json, and the voice reads the spoken text", async () => {
    seed();
    await runStage(RUN, "speak");
    const out = (await readSpoken(RUN))!;
    expect(out.method).toBe("sonnet-spoken-v1");
    expect(llmInputs[0]).not.toContain("seg-welcome");
    const s1 = out.segments.find((s) => s.segmentId === "seg-s1")!;
    expect(s1.spoken).toBe("Inspectors found led in the water, and Senator Ann Lee, Republican of Florida, asked for 1.2 billion dollars.");
    const ids = await phase3.planVoiceUnits(RUN);
    for (const id of ids) await phase3.runVoiceUnit(RUN, id);
    expect(voiced).toContain(s1.spoken);
    expect(voiced).toContain("This is Spread the News, where we read across the spectrum so you don't have to.");
  });

  it("falls back to the rules when the Claude call fails", async () => {
    seed();
    claudeReply = null;
    await runStage(RUN, "speak");
    const out = (await readSpoken(RUN))!;
    expect(out.warnings[0]).toMatch(/rules only/);
    expect(out.segments[1].spoken).toContain("found lead");
    expect(out.segments[1].spoken).toContain("Senator Ann Lee");
  });

  it("voices the display text when the script changed after speak ran, or speak is off", async () => {
    seed({ speak: "none" });
    await runStage(RUN, "speak");
    expect(llmInputs).toHaveLength(0);
    const ids = await phase3.planVoiceUnits(RUN);
    for (const id of ids) await phase3.runVoiceUnit(RUN, id);
    expect(voiced).toContain("Inspectors found lead in the water, and Sen. Ann Lee, R-Fla., asked for $1.2B.");
  });
});
