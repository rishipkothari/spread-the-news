import type { Article, HistoryStory, Source } from "@/lib/types";

export const CLUSTER_SYSTEM = `You group news articles from many outlets into stories for a neutral daily news digest.

A "story" is one specific news event or development (e.g. "Senate passes stopgap funding bill"), not a broad topic (not "US politics"). Articles about the same event from different outlets belong together even when their framing differs. Follow-ups, reactions and analysis about that same event belong to it too, including officials' or politicians' comments on it (e.g. "Trump comments on the FBI breach" belongs with the FBI breach story, not a separate story). Do not merge distinct events just because they share a theme.

For each story return:
- title: a short, neutral, factual headline (no loaded words, no outlet framing, no clickbait).
- category: exactly one of
  - us: domestic US news, including politics, policy, courts, crime, disasters, elections
  - world: events centered outside the US (including US foreign policy where the event happens abroad)
  - business: economy, markets, companies, labor, tech industry
  - science: science, health, medicine, environment, climate, space, technology research
  - sports
  - other: entertainment, culture, lifestyle that fits nothing else
- secondaryCategory: optional, only when a second category clearly applies.
- continuesStoryId: if the story is a continuation of one in RECENT STORIES, that story's id (like "h12"); otherwise omit.
- articles: every article in the story, each with its numeric id and type:
  - news: straight reporting of events
  - analysis: explanatory or interpretive reporting by a journalist
  - opinion: columns, editorials, commentary, op-eds, advocacy

Rules:
- Only return stories covered by at least {MIN_OUTLETS} different outlets. Skip articles that belong to no such story.
- Each article id may appear in at most one story. Use only ids from the ARTICLES list.
- Judge by title, summary, section and tags; do not invent facts.`;

export function buildClusterUser(articles: Article[], sources: Source[], history: HistoryStory[], maxSummary = 220): string {
  const name = new Map(sources.map((s) => [s.id, s.name]));
  const lines = articles.map((a, i) => {
    const meta = [a.section ? `section:${a.section}` : "", a.feedCategories.length ? `tags:${a.feedCategories.slice(0, 5).join(", ")}` : ""]
      .filter(Boolean)
      .join(" | ");
    const summary = a.summary ? ` — ${a.summary.slice(0, maxSummary)}` : "";
    return `${i + 1} | ${name.get(a.sourceId) ?? a.sourceId}${meta ? ` | ${meta}` : ""} | ${a.title}${summary}`;
  });
  const hist = history.map((h, i) => `h${i + 1} | ${h.date} | ${h.category} | ${h.title}`);
  return [
    `RECENT STORIES (last days, for continuesStoryId):`,
    hist.length ? hist.join("\n") : "(none)",
    ``,
    `ARTICLES (id | outlet | section/tags | title — summary):`,
    lines.join("\n"),
  ].join("\n");
}
