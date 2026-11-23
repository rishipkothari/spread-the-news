import type { ScriptChecker, ScriptWriter } from "../types";
import { neutralV1 } from "./neutral-v1";
import { quoteTraceV1 } from "./quote-trace-v1";
import { stubChecker, stubWriter } from "./stub";

export const writers: Record<string, ScriptWriter> = { [stubWriter.id]: stubWriter, [neutralV1.id]: neutralV1 };
export const checkers: Record<string, ScriptChecker> = { [stubChecker.id]: stubChecker, [quoteTraceV1.id]: quoteTraceV1 };
