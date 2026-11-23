import type { ScriptChecker, ScriptWriter } from "../types";

/** Free dry run: no LLM. Reads the agreed facts back as the segment. */
export const stubWriter: ScriptWriter = {
  id: "stub",
  async write({ synthesis }) {
    const facts = synthesis.agreedFacts.map((f) => f.fact);
    return { text: [synthesis.title + ".", ...facts].join(" "), usage: [] };
  },
};

/** Free dry run: passes everything; the runner's code checks still apply. */
export const stubChecker: ScriptChecker = {
  id: "stub",
  async check() {
    return { result: { pass: true, claims: [], issues: [], checker: "stub" }, usage: [] };
  },
};
