import { getJson, paths } from "@/lib/storage";
import type { StoryBundle, UsageEntry } from "@/lib/types";
import { emptyReview, type RunReview } from "@/review/types";
import ReviewClient from "./ReviewClient";
import RunNav from "../RunNav";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [bundle, usage, clustered, saved] = await Promise.all([
    getJson<StoryBundle>(paths.bundle(id)),
    getJson<UsageEntry[]>(paths.usage(id)),
    getJson<{ warnings: string[] }>(paths.stage(id, "cluster")),
    getJson<RunReview>(paths.review(id)),
  ]);
  if (!bundle) {
    return (
      <main>
        <RunNav runId={id} current="review" />
        <h1>Nothing to review yet</h1>
        <p className="muted">This run has no ranked bundle. Reviews need a run that finished the rank stage.</p>
      </main>
    );
  }
  // Keep the client payload small: drop article bodies.
  const slim: StoryBundle = {
    ...bundle,
    articles: bundle.articles.map(({ feedText: _f, text: _t, summary: _s, ...a }) => a),
  };
  return <ReviewClient bundle={slim} usage={usage ?? []} warnings={clustered?.warnings ?? []} initial={saved ?? emptyReview(id)} nav={<RunNav runId={id} current="review" />} />;
}
