import type { StorySynthesizer } from "../types";
import { stubSynthesizer } from "./stub";

export const synthesizers: Record<string, StorySynthesizer> = {
  [stubSynthesizer.id]: stubSynthesizer,
};
