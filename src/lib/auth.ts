import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Returns a 401 Response when the request lacks `Authorization: Bearer <RUN_SECRET>`. */
export function checkBearer(req: Request): Response | null {
  const secret = process.env.RUN_SECRET;
  if (!secret) return Response.json({ error: "RUN_SECRET not configured" }, { status: 500 });
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !safeEqual(token, secret)) return Response.json({ error: "unauthorized" }, { status: 401 });
  return null;
}

/** True when an `Authorization: Basic …` header carries PLAYER_PASSWORD (any username), as `proxy.ts` checks. */
export function basicAuthOk(header: string | null): boolean {
  const password = process.env.PLAYER_PASSWORD;
  if (!password || !header?.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  return safeEqual(decoded.slice(decoded.indexOf(":") + 1), password);
}
