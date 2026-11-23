import type { EpisodePlanner } from "../types";
import { wordBudgetV1 } from "./word-budget-v1";

export const planners: Record<string, EpisodePlanner> = { [wordBudgetV1.id]: wordBudgetV1 };
