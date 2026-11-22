# Spread the News — PRD v1

Nov 21, 2026 · @Rishi Kothari

## Summary and scope

Spread the News is a personal daily news podcast: 12 RSS sources balanced left to right, grouped into stories, ranked by how universally they are covered, summarized by LLMs and voiced by TTS. v1 is the "vanilla" episode, a 12–15 minute neutral headline digest generated once a day.

**Goals for v1**

- Identify the day's real headlines from cross-spectrum coverage, not any single outlet's editorial choices.
- Produce a 12–15 minute, 8–10 story episode every day, factually grounded in the source articles.
- Play it in a private web player.

**Users:** personal use only (one user). Data models must allow multiple users later without a rewrite.

**Non-goals for v1:** custom playlists, the lean slider, user accounts, a public podcast feed, scheduled runs (runs are manual but API-triggerable), local development.

**Guiding principles**

1. **Every stage is a swappable module.** Each stage is an interface with one or more implementations, chosen in config. Methods for fetching, grouping, ranking, ordering, extracting, scripting and TTS can each be tested independently and swapped without touching other stages.
2. **Vanilla is just one set of parameters.** Every run takes `RunParams`; vanilla is lean = center (0), categories = all. Later features change parameters, not the pipeline.
3. **Every run is saved.** Each stage's output is written to Blob so runs can be replayed, re-scored and debugged.
4. **Facts are shared, framing is not.** Story analysis is neutral and computed once. Lean, ordering and style apply only at the script stage.
5. **Callable by API.** Every run and every stage can be triggered over HTTP, so a cron job can be added later without code changes.
6. **Cost-aware, not cost-blocked.** Target about $2/day in steady state. Development can exceed that; every run logs its token and TTS usage.

## Architecture

One run is a chain of swappable stages executed as a Vercel Workflow and triggered over an authenticated API. Discovery (Phase 0) produces a ranked `StoryBundle`; analysis (Phase 1) turns the top stories into neutral, quote-backed story summaries; script and audio (Phases 2–3) turn those into a checked, voiced episode.

&#91;embedded content: pipeline · 12 stages in 3 phases, ending at the player\]

The analysis row runs right to left so the flow snakes down the page. Story history feeds both grouping, to link stories across days, and synthesis, for "what happened recently" context; each run's synthesis summaries are added back into it.

## Data model

Every stage reads and writes these types. Vanilla is `RunParams` with `lean: 0` and `categories: "all"`; nothing downstream special-cases it.

```typescript
type LeanLabel = "left" | "lean_left" | "center" | "lean_right" | "right";
// numeric lean: left -2, lean_left -1, center 0, lean_right +1, right +2
type Category = "us" | "world" | "business" | "science" | "sports" | "other";
type ArticleType = "news" | "analysis" | "opinion";

interface Source {
  id: string;                 // "fox", "motherjones"
  name: string;
  homepage: string;
  feeds: { url: string; section?: string; prominence: "top" | "section" }[];
  lean: LeanLabel;
  leanValue: number;          // -2..+2
  leanProvenance: { source: "allsides"; checkedOn: string };
  paywall: "none" | "metered" | "hard";
  fullTextInFeed: boolean;
  enabled: boolean;
}

interface Article {
  id: string;                 // hash of canonical URL
  sourceId: string;
  url: string;
  title: string;
  summary?: string;
  feedText?: string;          // content:encoded when present
  feedCategories: string[];
  section?: string;           // from section feed
  prominence: "top" | "section";
  publishedAt: string;        // normalized ISO, future dates capped
  articleType?: ArticleType;  // set by the clusterer
  text?: string;              // set by the extractor
  textStatus?: "full" | "partial" | "headline_only";
  extractor?: string;         // which extractor produced text
}

interface Story {
  id: string;
  title: string;              // neutral title from the clusterer
  category: Category;
  secondaryCategory?: Category;
  articleIds: string[];
  continuesStoryId?: string;  // link to a prior day's story
  signals: {
    outletCount: number;      // distinct outlets, opinion at 0.5
    coverage: number;         // 0..1
    balance: number;          // 0..1
    skew: number;             // 0..1
    prominence: number;       // 0..1
    firstSeen: string;
  };
  headlineIndex: number;      // global, neutral rank score
}

interface RunParams {
  lean: number;               // -2..+2; 0 = central (vanilla)
  categories: Category[] | "all";
  targetDurationSec: number;  // vanilla 780 (13 min)
  storyCount?: { min: number; max: number };   // vanilla 8..10
  orderStrategy: string;      // vanilla "top-then-category"
  scriptStyle: string;        // vanilla "neutral-v1"
}

interface StoryBundle {
  runId: string;
  createdAt: string;
  window: { start: string; end: string };
  params: RunParams;
  methods: Record<string, string>;  // stage -> implementation id
  sources: Source[];
  sourceHealth: Record<string, { ok: boolean; items: number; error?: string }>;
  articles: Article[];
  stories: Story[];           // sorted by headlineIndex
}
```

**Story history.** A rolling index of the last 14 days of stories (id, date, title, category, the story synthesis summary). The clusterer receives recent titles so it can set `continuesStoryId`. The synthesizer receives the linked chain so every segment has a "what happened recently" context. That chain also becomes a "Before this story" bullet summary if a text version is added later.

**Analysis outputs** (Phase 1): `ArticleFacts` (per article: facts with exact supporting quotes) and `StorySynthesis` (per story: agreed facts, disputed claims with who claims what, framing by side, recent background from history).

**Script and audio** (Phases 2–3): a `Segment` is `{ id, storyId?, kind: "intro" | "story" | "outro", text, checkerResult, scriptHash }`. Audio is cached at `audioKey = hash(text + voice + ttsProvider)`, so the same text in the same voice is never generated twice. An `Episode` is `{ id, date, params, segmentIds[], audioUrl, durationSec }`.

## Sources

12 outlets, 4 per side. Feeds were checked on 2026-11-21 from Claude's fetcher. Sites marked unverified blocked that fetcher and must be tested from Vercel in Phase 0. Lean ratings are AllSides; only Fox and NewsNation were confirmed against current AllSides pages, and the rest come from the 2019 AllSides dataset and need re-checking.

| Lean | Outlet | Feed URL | Full text in feed | Category tags | Status |
| --- | --- | --- | --- | --- | --- |
| Left | Mother Jones | https://www.motherjones.com/feed/ | Yes | Yes | Verified |
| Left | Daily Beast | https://www.thedailybeast.com/arc/outboundfeeds/rss/articles/ | No | Minimal | Verified |
| Left | The Nation | https://www.thenation.com/feed/?post\_type=article | No | No | Verified; opinion-heavy |
| Left | HuffPost | https://www.huffpost.com/section/front-page/feed | Unknown | Unknown | Unverified: robots.txt blocked Claude's fetcher |
| Center | BBC News | https://feeds.bbci.co.uk/news/rss.xml (+ world, us\_and\_canada, business, science\_and\_environment section feeds; sport) | No (headline + 1 line) | Via section feeds | Unverified: fetcher blocked; listed active in a feed directory. May be Lean Left (2022 AllSides survey) |
| Center | The Hill | https://thehill.com/feed/ | No | Yes | Verified |
| Center | NewsNation | https://www.newsnationnow.com/feed/ | No | Yes | Verified; AllSides Center (current) |
| Center | Christian Science Monitor | https://rss.csmonitor.com/feeds/all | No | No | Verified; \~10 items, feature-heavy |
| Right | Fox News | https://moxie.foxnews.com/google-publisher/latest.xml | Yes | Yes | Verified; AllSides Right (current) |
| Right | Daily Wire | https://www.dailywire.com/feeds/rss.xml | Yes | No | Verified |
| Right | Daily Caller | https://dailycaller.com/feed/ | No | Yes | Verified; items ordered by score, not date |
| Right | Breitbart | https://feeds.feedburner.com/breitbart | No | Yes | Stale: newest item 2026-10-27 when checked; breitbart.com/feed redirects here |

**Known biases in the source set**

- Volume differs by outlet (The Hill and Fox post dozens of items a day; Mother Jones and CSM a handful). Scoring counts outlets, not articles, but low-volume sides will still appear to cover fewer stories.
- Partisan outlets cover little world, science or sports news, so balance signals mean less in those categories.
- Lean labels are hard-coded per source. A source that drifts must be re-labeled by hand.

**Source module.** `SourceRegistry.getSources(): Source[]`. v1 implementation: a static `sources.json`. Disabling a source is a config change, and the registry is where a future automated rating lookup would plug in.

## Pipeline components

Each stage is a TypeScript interface; the implementation is chosen by id in config. A tool that does several stages at once (for example NewsAPI.ai fetching and grouping) implements each interface it covers, and the later stage's implementation passes its results through.

| # | Stage | Interface | v1 implementation | Model | Phase |
| --- | --- | --- | --- | --- | --- |
| 1 | Sources | `SourceRegistry` | `static-json` | none | 0 |
| 2 | Fetch and normalize | `ArticleFetcher` | `rss` | none | 0 |
| 3 | Group into stories, label | `StoryClusterer` | `llm-single-pass` | Sonnet | 0 |
| 4 | Rank | `StoryRanker` | `headline-index-v1` | none | 0 |
| 5 | Link across days | `StoryLinker` | inside the clusterer call, using story history | Sonnet | 1 |
| 6 | Full text | `ArticleTextExtractor` | chain: `feed-content` → `readability` → headline-only | none | 1 |
| 7 | Per-article facts | `ArticleAnalyzer` | `haiku-facts-v1` | Haiku | 1 |
| 8 | Per-story comparison | `StorySynthesizer` | `sonnet-synthesis-v1` | Sonnet | 1 |
| 9 | Pick and order | `EpisodePlanner` | `top-then-category` | none | 2 |
| 10 | Write segments | `ScriptWriter` | `neutral-v1` | Sonnet | 2 |
| 11 | Fact-check | `ScriptChecker` | `quote-trace-v1` | Sonnet | 2 |
| 12 | Voice | `TTSProvider` | `edge-tts`; `kokoro` as a free alternative | none | 3 |
| 13 | Assemble | `EpisodeAssembler` | `mp3-concat` | none | 3 |
| 14 | Play | web player | private Next.js page | none | 3 |

**Stage notes**

- **Fetch and normalize:** parse every feed, normalize dates to ISO, cap future dates, sort by date (Daily Caller orders by score), de-duplicate by canonical URL and GUID, keep a 24-hour window. Record per-source health (ok, item count, error).
- **Clusterer contract:** one call with every article (numeric id, outlet, title, summary, feed section and tags) plus the last 14 days of story titles. Returns JSON: stories with a neutral title, primary and optional secondary category, article ids, an optional `continuesStoryId`, and an `articleType` per article. Code validates that every returned id exists and drops unknown ids. Category rule: `us` = domestic (including politics, policy, courts, crime, disasters); `world` = centered outside the US; `other` = entertainment and lifestyle that fits nothing else.
- **Extractor chain:** only articles in selected stories. Try the feed's own full text, then fetch the page and run Readability (TypeScript), then mark headline-only and fall back to the RSS summary. A quality check rejects text under a minimum length or containing paywall phrases. Honor robots.txt. Cache by URL. Produce a per-source success-rate report.
- **Article analysis:** news and analysis articles only; opinion is excluded from fact extraction. Each fact carries an exact quote from the article so the checker can trace it.
- **Story synthesis:** agreed facts, disputed claims with who claims what, framing by side, and a "recently" background section built from the linked story chain.
- **Episode planner:** applies `RunParams` (categories, duration, story count) and an ordering strategy. Vanilla: top-ranked story first, then grouped by category in the order us, world, business, science, sports, other, ranked within each group. Ordering is a pluggable strategy.
- **Script writer:** writes intro, story and outro segments separately so the story bank fills as a side effect. Script style (straight news versus point and counterpoint) is a dedicated prompt-design task in Phase 2.
- **Checker:** traces every claim in a segment back to extracted quotes. On failure: one rewrite of that segment; if it fails again, drop the story and log it. Never publish an unverified claim.
- **TTS and assembly:** segments are voiced separately and cached by `audioKey`. All segments use the same voice and output format so they can be joined by concatenation. Vanilla audio is generated in the batch run; any future non-vanilla segment is voiced on first request.

## Headline index

A story's global rank comes from how many outlets cover it, how evenly the spectrum covers it, and a penalty for coverage that leans to one side. All weights live in config and are expected to change after the first week of saved runs.

```latex
\text{index} = \left(0.55\,C + 0.30\,B + 0.15\,P\right) \times \left(1 - 0.5\,S\right) \times R
```

| Term | Name | Definition | Range |
| --- | --- | --- | --- |
| C | Coverage | Distinct covering outlets ÷ outlets that returned data this run. An outlet whose only article on the story is opinion counts 0.5. | 0–1 |
| B | Balance | Evenness across the left, center and right groups. Per group, coverage share = covering outlets ÷ active outlets in that group; B = normalized entropy of those three shares (0 = one group only, 1 = all three equal). | 0–1 |
| P | Prominence | Share of covering outlets that carried the story in a top-stories feed. | 0–1 |
| S | Skew | Absolute value of the article-weighted mean lean of the story's coverage (lean −2..+2, opinion weighted 0.5), divided by 2. 10 left articles + 1 right article ≈ 0.8. | 0–1 |
| R | Recency | 0.5 ^ (hours since the story's newest article ÷ 24). | 0–1 |

**Rules**

- A story needs at least 3 distinct outlets to be ranked.
- No category or one-sided-story exclusions: any category can lead vanilla if it ranks high enough, and stories covered by one side fall out through low C and B and the S penalty.
- Denominators use only outlets that returned data that run, so a failed feed does not distort the scores.
- Saved bundles keep the raw signals, so re-scoring old runs with new weights needs no LLM calls.

**User rank (Phase 5).** A second score computed from the same stored signals plus `RunParams.lean`, for example rewarding coverage from the chosen side. Vanilla (`lean: 0`) uses the global index unchanged.

## Operations: API, storage, config, cost, failures

Runs are started by hand through an authenticated API, executed as a Vercel Workflow, and leave every intermediate output in Blob.

**API** (all routes require `Authorization: Bearer <RUN_SECRET>`)

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/runs` | Start a run. Body: optional `params` (defaults to vanilla), optional `stages` range (e.g. through `rank`), optional `replayFrom` run id to reuse saved inputs. Returns `runId`. |
| GET | `/api/runs/:id` | Run status, per-stage status, usage and links to stage outputs. |
| POST | `/api/runs/:id/stages/:stage` | Re-run one stage from that run's saved inputs, for example re-ranking with new weights. |
| GET | `/api/episodes/latest` | Latest vanilla episode metadata and audio URL. |
| GET | `/debug/runs/:id` | Page: source health, ranked stories with lean bars and signals, articles per story. |

A cron job is out of scope for now; adding one later is a thin route that calls the same run function.

**Orchestration.** Vercel Workflows (TypeScript SDK). Each stage is a durable step; per-story work (extraction, analysis, synthesis, segments, TTS) fans out as one step per story. Steps retry on transient errors. Every LLM response is validated against a zod schema, with one retry on invalid output.

**Blob layout**

```
runs/{runId}/bundle.json          StoryBundle after ranking
runs/{runId}/{stage}.json         every stage's output
runs/{runId}/usage.json           tokens, cost, timings per stage
history/stories-14d.json          rolling story index for cross-day linking
cache/text/{urlHash}.json         extracted article text
segments/{scriptHash}.json        segment text + checker result
audio/{audioKey}.mp3              voiced segment
episodes/{date}-{paramsHash}.json episode manifest (+ .mp3)
```

Blob URLs use random suffixes, and the web player sits behind a password, because episodes rewrite copyrighted reporting. Article text is deleted after 30 days. Non-vanilla audio is deleted after 30 days; bundles, scripts and vanilla episodes are kept.

**Config** (`config/pipeline.json`): the implementation id per stage, the model per stage, ranking weights, time window (24 h), story history depth (14 days), and the vanilla `RunParams`. Environment: `ANTHROPIC_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `RUN_SECRET`, `PLAYER_PASSWORD`.

**Cost.** Estimated steady-state cost per vanilla run:

| Stage | Model | Estimate |
| --- | --- | --- |
| Clustering (\~30k tokens in) | Sonnet | \~$0.09 |
| Per-article facts (\~100 articles) | Haiku | \~$0.03 |
| Per-story synthesis (\~20 stories) | Sonnet | \~$0.70 |
| Script + checker | Sonnet | \~$0.20 |
| TTS | edge-tts | $0 |
| **Total** |  | **\~$1/day** |

The $2/day figure is a soft long-term target, not a limit; development will cost more. The Anthropic console spend limit is the hard backstop. Batch API (50% off) is an option for scheduled runs, not for interactive development. `usage.json` makes cost per stage visible on the debug page.

**Failure policy**

- Publish a shorter episode if at least 8 of 12 sources returned data and at least 5 stories pass the checker.
- Otherwise produce no episode, and mark the run failed with reasons on the debug page.
- A source that fails is excluded from that run's denominators.

**Development environment.** Remote only: code is written by an agent in Claude Code on the web and nothing runs on a local machine. The agent's sandbox likely cannot reach news sites, so unit tests run against fixture bundles committed to the repo, and live runs are verified on Vercel preview deployments through the API and the debug page.

## Phases

v1 (the vanilla podcast) is complete at the end of Phase 3. Phase 0 is the riskiest step: if grouping and ranking do not produce believable headlines, nothing later matters, so it is validated before anything else is built.

1. **Phase 0: Foundation and story discovery**
   - Next.js + TypeScript repo, Vercel project, Blob, env vars, Workflows wiring, the `/api/runs` endpoint and auth.
   - `SourceRegistry` (12 sources), `ArticleFetcher` (RSS + normalization + source health), `StoryClusterer` (Sonnet, with categories and article types), `StoryRanker` (headline index).
   - Saved `StoryBundle` per run; `/debug/runs/:id` page; fixture bundles for tests.
   - Exit: one week of manual runs where the ranked list looks like that day's real headlines.
2. **Phase 1: Full text and story analysis**
   - `ArticleTextExtractor` chain with quality check, cache and per-source success report.
   - Story history and cross-day linking.
   - `ArticleAnalyzer` (Haiku facts + quotes) and `StorySynthesizer` (Sonnet comparison + recent background).
   - Exit: spot checks of synthesis JSON hold up against the source articles; extraction succeeds for most articles from each source.
3. **Phase 2: Script and checker**
   - `EpisodePlanner` with the `top-then-category` strategy.
   - Script prompt design (style decided here), `ScriptWriter` producing intro, story and outro segments, `ScriptChecker` with the rewrite-then-drop policy.
   - Exit: scripts read well and pass the checker without manual edits for several consecutive runs.
4. **Phase 3: Audio and delivery (v1 complete)**
   - `TTSProvider` interface, edge-tts adapter, segment audio cache, `EpisodeAssembler`, vanilla audio generated in the run.
   - Private web player; intro and outro wording finalized.
   - Exit: a vanilla episode can be triggered and played on a phone end to end.
5. **Phase 4: Story bank and playlists**
   - Move from Blob JSON to Neon + Drizzle.
   - A profile becomes a query over the story bank (category percentages, duration); audio for non-vanilla segments is generated on first request; playlists assemble on demand.
6. **Phase 5: Lean slider**
   - User rank from lean; framed script styles (attributed and in-voice); lean announced at the start of each episode.

## Decisions, open questions, tasks

**Decision log**

| Topic | Decision |
| --- | --- |
| Users | Personal use only; models allow more users later |
| Hosting | Vercel (Hobby), Blob storage, Vercel Workflows |
| Language | All TypeScript (Next.js); Readability for extraction |
| Ingest | RSS from 12 sources, 4 per side; NewsAPI.ai and Google News kept as possible future adapters |
| Lean scale | Store AllSides 5-point labels; group into left, center, right for balance logic; label sources by current rating, not to force a 4/4/4 split |
| Grouping | One LLM call (Sonnet) per run; embeddings or a hybrid only if consistency is poor |
| Categories | us, world, business, science, sports, other; assigned per story at the clustering step |
| Opinion | Labeled news, analysis or opinion at clustering; opinion counts 0.5 in coverage and skew and is excluded from fact extraction |
| Ranking | Headline index (coverage, balance, prominence, skew penalty, recency); no category or one-sided exclusions; minimum 3 outlets |
| Vanilla | Lean 0, all categories, 12–15 min, 8–10 stories, one narrator, every day including weekends; top story then by category |
| Cross-day | Stories link to prior days; a story repeats only with substantial new developments, framed as an update |
| Checker | One rewrite, then drop the story; never publish an unverified claim |
| Audio timing | Scripts generated in the batch run; vanilla audio pre-generated; other audio on first request; cache by hash |
| TTS | edge-tts behind an interface; Kokoro as the free fallback |
| Triggering | Manual via authenticated API; cron later |
| Cost | \~$2/day soft long-term target; development may exceed it |
| Retention | Article text and non-vanilla audio 30 days; bundles, scripts, vanilla episodes kept |
| robots.txt | Honored strictly |
| Story bank | Blob JSON in v1; Neon + Drizzle in Phase 4 |

**Open questions**

- Script style for vanilla: straight news, a coverage-difference line, or point and counterpoint (Phase 2 prompt design).
- Intro and outro wording and voice choice (Phase 3).
- Replacements if HuffPost, BBC or Breitbart fail from Vercel.
- Starting weights of the headline index after the first week of saved runs.
- Whether single-call grouping is consistent enough day to day, or needs the embeddings hybrid.

**Implementation tasks**

- [ ] Scaffold Next.js + TypeScript, Vercel Workflows, Blob client, zod, Anthropic SDK; `config/pipeline.json`; env var checks
- [ ] Auth middleware for `RUN_SECRET`; `/api/runs` and `/api/runs/:id`
- [ ] `sources.json` with the 12 sources; feed health check run from a Vercel preview
- [ ] Re-check AllSides ratings for all non-verified sources (BBC first)
- [ ] Map section feeds and top-stories feeds per source (BBC, Fox, The Hill) for category hints and prominence
- [ ] RSS fetcher: date normalization, future-date cap, re-sort, de-duplication, 24-hour window, source health
- [ ] Clustering prompt and zod schema; id validation; categories and article types
- [ ] Headline index implementation with config weights; unit tests on fixture bundles
- [ ] Save bundle and stage outputs to Blob; `usage.json`
- [ ] `/debug/runs/:id` page with source health, ranked stories, lean bars, signals
- [ ] Phase 1 onward per the phase list above
