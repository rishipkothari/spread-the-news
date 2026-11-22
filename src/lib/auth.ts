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
