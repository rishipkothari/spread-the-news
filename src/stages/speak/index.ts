import type { SpokenScriptWriter } from "../types";
import { noSpoken, rulesOnly, sonnetSpokenV1 } from "./sonnet-spoken-v1";

export const speakers: Record<string, SpokenScriptWriter> = { [sonnetSpokenV1.id]: sonnetSpokenV1, [rulesOnly.id]: rulesOnly, [noSpoken.id]: noSpoken };
