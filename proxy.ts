import { NextResponse, type NextRequest } from "next/server";

/** Password gate for browser pages (debug + player): HTTP Basic auth, any username, PLAYER_PASSWORD. */
export function proxy(req: NextRequest) {
  const password = process.env.PLAYER_PASSWORD;
  if (!password) return new NextResponse("PLAYER_PASSWORD not configured", { status: 500 });
  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    const given = decoded.slice(decoded.indexOf(":") + 1);
    if (given === password) return NextResponse.next();
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Spread the News"' },
  });
}

export const config = {
  // API routes use Bearer auth in their handlers; Workflow's internal routes must not be intercepted.
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|.well-known/workflow/).*)"],
};
