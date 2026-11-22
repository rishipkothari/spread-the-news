import { loadSources } from "@/sources/store";

export const dynamic = "force-dynamic";

/** Download the live source list in the repo's config/sources.json format (to commit back). */
export async function GET() {
  const { sources, origin, updatedAt } = await loadSources();
  const body = {
    _note: `Exported from the admin feeds page (${origin}${updatedAt ? `, edited ${updatedAt}` : ""}). Lean labels are AllSides ratings; see verified flags.`,
    sources,
  };
  return new Response(`${JSON.stringify(body, null, 2)}\n`, {
    headers: { "content-type": "application/json", "content-disposition": 'attachment; filename="sources.json"' },
  });
}
