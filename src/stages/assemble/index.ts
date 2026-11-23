import type { EpisodeAssembler } from "../types";
import { mp3Concat } from "./mp3-concat";

export const assemblers: Record<string, EpisodeAssembler> = { [mp3Concat.id]: mp3Concat };
