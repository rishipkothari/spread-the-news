import type { StorySynthesizer } from "../types";
import { sonnetSynthesisV1 } from "./sonnet-synthesis-v1";
import { stubSynthesizer } from "./stub";

export const synthesizers: Record<string, StorySynthesizer> = {
  [stubSynthesizer.id]: stubSynthesizer,
  [sonnetSynthesisV1.id]: sonnetSynthesisV1,
};
