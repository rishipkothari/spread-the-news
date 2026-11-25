import { dayNeighbours, readNewsDay, readNewsIndex } from "@/news/store";

export const dynamic = "force-dynamic";

/**
 * One day's story rows, section counts and episode, plus the neighbouring published days
 * (`older` loads next in infinite scroll; `newer` for the › arrow). A date with nothing published returns
 * `day: null` with its neighbours, so the page can show the empty state and still move on.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ date: string }> }) {
  const { date } = await ctx.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  const [day, index] = await Promise.all([readNewsDay(date), readNewsIndex()]);
  const { older, newer } = dayNeighbours(index, date);
  return Response.json({ date, day, older: older ?? null, newer: newer ?? null }, { headers: { "Cache-Control": "private, max-age=60" } });
}
