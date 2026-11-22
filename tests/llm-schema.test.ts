import { describe, expect, it } from "vitest";
import { z } from "zod";
import { jsonSchemaFor } from "@/lib/llm";
import { ClusterOutput } from "@/stages/cluster/llm-single-pass";

describe("structured output schema", () => {
  it("strips keywords the API rejects", () => {
    const json = JSON.stringify(jsonSchemaFor(ClusterOutput));
    for (const k of ["minimum", "maximum", "$schema"]) expect(json).not.toContain(`"${k}"`);
    expect(json).toContain('"type":"integer"');
  });

  it("keeps a property literally named like a keyword", () => {
    const schema = jsonSchemaFor(z.object({ minimum: z.number().int() }));
    expect(Object.keys((schema.properties as object) ?? {})).toEqual(["minimum"]);
  });
});
