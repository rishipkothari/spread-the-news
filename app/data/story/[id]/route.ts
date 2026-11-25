import { readNewsStory } from "@/news/store";

export const dynamic = "force-dynamic";

/** One story page's data by public id (`{date}-{storyId}`): script, analysis, outlets, track. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const story = await readNewsStory(id);
  if (!story) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(story, { headers: { "Cache-Control": "private, max-age=60" } });
}
