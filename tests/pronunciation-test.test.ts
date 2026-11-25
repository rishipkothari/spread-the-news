import { describe, expect, it, vi } from "vitest";

const sent: string[] = [];
vi.mock("msedge-tts", () => ({
  OUTPUT_FORMAT: { AUDIO_24KHZ_48KBITRATE_MONO_MP3: "mp3" },
  MsEdgeTTS: class {
    async setMetadata() {}
    toStream(input: string) {
      sent.push(input);
      const { PassThrough } = require("node:stream");
      const s = new PassThrough();
      setTimeout(() => s.end(Buffer.alloc(1000, 1)), 0);
      return { audioStream: s };
    }
    close() {}
  },
}));

import { buildTestReport, clipKey, PRONUNCIATION_TEST } from "@/audio/pronunciation-test";
import { edgeTts } from "@/stages/tts/edge-tts";

describe("pronunciation test sheet", () => {
  it("has unique ids and covers every category", () => {
    const ids = PRONUNCIATION_TEST.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of PRONUNCIATION_TEST) {
      const vids = item.variants.map((v) => v.id);
      expect(new Set(vids).size, item.id).toBe(vids.length);
      expect(item.variants.length, item.id).toBeGreaterThanOrEqual(2);
    }
    const cats = new Set(PRONUNCIATION_TEST.map((i) => i.category));
    for (let c = 1; c <= 20; c++) expect(cats.has(String(c)), `category ${c}`).toBe(true);
  });

  it("keeps markup XML-safe and plain text free of tags", () => {
    for (const item of PRONUNCIATION_TEST) {
      for (const v of item.variants) {
        if (v.markup) {
          const outside = v.text.replace(/<[a-z-]+(\s+[a-z:-]+="[^"<>&]*")*\s*\/?>|<\/[a-z-]+>/g, "");
          expect(outside, `${item.id}/${v.id}`).not.toMatch(/[<>&]/);
        } else {
          expect(v.text, `${item.id}/${v.id}`).not.toMatch(/</);
        }
      }
    }
  });

  it("reports marks, failures and notes", () => {
    const r = buildTestReport(
      { marks: { [clipKey("read-intro", "respell")]: "ok", [clipKey("read-intro", "plain")]: "bad" }, notes: { "read-intro": "red is right" }, errors: { [clipKey("read-intro", "ipa")]: "refused" } },
      "en-US-AriaNeural",
      "edge-tts",
    );
    expect(r).toContain("✓ right · Respelled “red”");
    expect(r).toContain("✗ wrong · As written");
    expect(r).toContain("FAILED (refused) · Phoneme tag (IPA) [markup]");
    expect(r).toContain("- Note: red is right");
    expect(r).toContain("– not marked");
  });
});

describe("edge-tts markup", () => {
  it("escapes plain text but passes markup through", async () => {
    sent.length = 0;
    await edgeTts.synthesize("AT&T <b>", "v");
    await edgeTts.synthesizeMarkup!(`a <break time="800ms"/> b`, "v");
    expect(sent).toEqual(["AT&amp;T &lt;b&gt;", `a <break time="800ms"/> b`]);
  });
});
