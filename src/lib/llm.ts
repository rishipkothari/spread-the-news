import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { priceFor } from "./config";
import type { UsageEntry } from "./types";

let client: Anthropic | null = null;
export function anthropic(): Anthropic {
  client ??= new Anthropic();
  return client;
}

export type LlmUsage = Omit<UsageEntry, "stage" | "ms">;

export class LlmOutputError extends Error {}

export function usageFrom(model: string, u: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }): LlmUsage {
  const p = priceFor(model);
  const cacheRead = u.cache_read_input_tokens ?? 0;
  const cacheWrite = u.cache_creation_input_tokens ?? 0;
  const costUsd = p
    ? (u.input_tokens * p.input + u.output_tokens * p.output + cacheRead * p.cacheRead + cacheWrite * p.cacheWrite) / 1_000_000
    : undefined;
  return { model, inputTokens: u.input_tokens, outputTokens: u.output_tokens, cacheReadTokens: cacheRead, cacheWriteTokens: cacheWrite, costUsd };
}

/**
 * Keywords the structured-outputs schema subset rejects. Zod still enforces them
 * when the response is validated, so dropping them from the request loses nothing.
 */
const UNSUPPORTED_KEYS = new Set([
  "$schema", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf",
  "minLength", "maxLength", "pattern", "minItems", "maxItems", "uniqueItems", "minProperties", "maxProperties",
]);

export function sanitizeSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sanitizeSchema);
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      if (UNSUPPORTED_KEYS.has(k)) continue;
      // "properties" maps names → schemas; never treat a property *name* as a keyword.
      out[k] = k === "properties" && v && typeof v === "object"
        ? Object.fromEntries(Object.entries(v).map(([name, sub]) => [name, sanitizeSchema(sub)]))
        : sanitizeSchema(v);
    }
    return out;
  }
  return node;
}

export function jsonSchemaFor(schema: z.ZodType): Record<string, unknown> {
  return sanitizeSchema(z.toJSONSchema(schema, { target: "draft-2020-12" })) as Record<string, unknown>;
}

/**
 * One structured-output call: streams (large outputs), validates with zod,
 * and retries once on invalid output. Server-side refusal fallback is enabled.
 */
export async function structuredCall<T extends z.ZodType>(opts: {
  model: string;
  system: string;
  user: string;
  schema: T;
  maxTokens: number;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
}): Promise<{ data: z.infer<T>; usage: LlmUsage[] }> {
  // Server-side refusal fallback exists for Sonnet/Opus/Fable, not Haiku.
  const fallback = /^claude-(sonnet|opus|fable)/.test(opts.model);
  const usage: LlmUsage[] = [];
  let lastErr = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const stream = anthropic().beta.messages.stream({
      model: opts.model,
      max_tokens: opts.maxTokens,
      ...(fallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: opts.user }],
      output_config: {
        effort: opts.effort ?? "medium",
        format: { type: "json_schema", schema: jsonSchemaFor(opts.schema) },
      },
    });
    const msg = await stream.finalMessage();
    usage.push(usageFrom(msg.model ?? opts.model, msg.usage));
    if (msg.stop_reason === "refusal") throw new LlmOutputError(`model refused: ${msg.stop_details?.category ?? "unknown"}`);
    if (msg.stop_reason === "max_tokens") {
      lastErr = "output truncated at max_tokens";
      continue;
    }
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    try {
      const parsed = opts.schema.safeParse(JSON.parse(text));
      if (parsed.success) return { data: parsed.data, usage };
      lastErr = parsed.error.message.slice(0, 500);
    } catch (e) {
      lastErr = `invalid JSON: ${(e as Error).message}`;
    }
  }
  throw new LlmOutputError(`structured output failed after retry: ${lastErr}`);
}
