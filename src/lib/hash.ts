import { createHash, randomBytes } from "node:crypto";

export function sha(input: string, len = 16): string {
  return createHash("sha256").update(input).digest("hex").slice(0, len);
}

/** Run ids sort by time: 2026-11-22T0412-ab12cd */
export function newRunId(now = new Date()): string {
  const iso = now.toISOString();
  return `${iso.slice(0, 10)}T${iso.slice(11, 13)}${iso.slice(14, 16)}-${randomBytes(3).toString("hex")}`;
}
