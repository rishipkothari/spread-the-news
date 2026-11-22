# Architecture

How the code is organized and how a run flows. The design rationale is in `docs/PRD.md`; deviations are in `docs/decisions.md`.

## Run flow

```
POST /api/runs  or  "Start full run" button (server action)
  └─ src/pipeline/start.ts  startRun()      writes runs/{id}/status.json, starts the workflow
       └─ src/workflows/pipeline.ts         "use workflow": stages in order, one durable step each
            └─ src/workflows/steps.ts       "use step": runStage(); LLM-output and 4xx errors are FatalError (no retry)
                 └─ src/pipeline/run.ts     runners per stage: read inputs from Blob → call implementation → write output, status, usage
```

Stages (`src/pipeline/stages.ts`): `sources → fetch → cluster → rank` (discovery; a plain run stops here) and `extract → analyze → synthesize` (Phase 1, started separately with "Run analysis"). Phase 1 stages fan out: `planUnits` picks the top stories and writes `analysis-plan.json`, `runUnit` runs once per story as its own workflow step (writing `runs/{id}/{stage}/{storyId}.json`), and `mergeStage` combines units into `runs/{id}/{stage}.json` and records usage and status (`src/pipeline/phase1.ts`). Each reads the previous stages' saved JSON, so any stage can be re-run alone (`POST /api/runs/:id/stages/:stage`, "Re-rank") or a new run can start mid-pipeline from another run's outputs (`replayFrom`, "Re-cluster").

## Swappable stages

`src/stages/types.ts` defines one interface per stage. Implementations live in `src/stages/<stage>/<id>.ts` and are registered in `src/stages/registry.ts`; `config/pipeline.json → methods` picks one by id. To add an implementation: write it against the interface, register it, switch the id in config.

| Stage | Interface | Implementation | Notes |
| :- | :- | :- | :- |
| sources | `SourceRegistry` | `blob-json` (default), `static-json` | `src/sources/store.ts` holds the Blob-editable list |
| fetch | `ArticleFetcher` | `rss` | `normalize.ts` (parse, dates, URLs, dedupe), `robots.ts`, `homepage.ts` (homepage positions) |
| cluster | `StoryClusterer` | `llm-single-pass` | `prompt.ts`; one Sonnet call, zod-validated via `src/lib/llm.ts structuredCall()` |
| rank | `StoryRanker` | `headline-index-v1` | pure function of saved signals; weights in config |
| extract | `ArticleTextExtractor` | `chain-v1` (default), `feed-only` | feed text → Readability → RSS summary; runner caches by URL |
| analyze | `ArticleAnalyzer` | `haiku-facts-v1` (default), `stub` | facts with verbatim quotes, verified in code |
| synthesize | `StorySynthesizer` | `sonnet-synthesis-v1` (default), `stub` | cites fact ids; `resolveSynthesis` maps them to quotes |

`src/lib/llm.ts` is the single place that calls Claude: streaming, structured output (schema sanitized for the API), one retry on invalid output, refusal fallback, usage and cost.

## Storage (Vercel Blob, private store)

```
runs/{runId}/status.json      run state, per-stage state and summaries, errors
runs/{runId}/{stage}.json     each stage's output (sources, fetch, cluster, rank)
runs/{runId}/bundle.json      StoryBundle after ranking
runs/{runId}/usage.json       tokens, cost, ms per stage
runs/{runId}/review.json      the user's review (verdicts) from the review page
runs/{runId}/analysis-plan.json  Phase 1: chosen stories and articles
runs/{runId}/{stage}/{story}.json Phase 1 per-story unit outputs
history/stories-14d.json      rolling story index for cross-day linking (+ synthesis summaries)
cache/text/{urlHash}.json     extracted article text (full/partial only)
config/sources.json           live source list edited on /debug/feeds (overrides the repo file)
config/sources-changelog.json edits made on /debug/feeds
admin/discovery/{source}.json last feed-discovery results per source
```

`src/lib/storage.ts` wraps Blob (`putJson`, `getJson`, `listPaths`, `paths`).

## Web

| Route | What |
| :- | :- |
| `/` | links to runs and the latest review |
| `/debug/runs`, `/debug/runs/[id]` | start runs; run status, source health, ranked stories, re-cluster / re-rank |
| `/debug/runs/[id]/review` | verdicts per story, autosaved; "Copy report for Claude" (`src/review/report.ts`) |
| `/debug/runs/[id]/analysis` | Phase 1 output: extraction by source, syntheses with quotes, copyable report |
| `/debug/feeds` | feed discovery and source editing (`src/admin/discover.ts`, `app/debug/feeds/actions.ts`) |
| `/api/runs…` | Bearer-authenticated API (see README) |

Auth: `proxy.ts` gates every non-API page with Basic auth (`PLAYER_PASSWORD`); API routes check `Bearer RUN_SECRET` (`src/lib/auth.ts`). Workflow's `/.well-known/workflow/*` routes are excluded from the proxy.

## Tests

`tests/` runs with vitest against fixtures (the sandbox can't reach news sites): feed parsing and normalization, robots.txt, ranking on `tests/fixtures/bundle-synthetic.json` (regenerate with `npx tsx scripts/make-fixture-bundle.ts`), cluster-output validation, schema sanitizing, homepage matching, feed discovery, review report, Phase 1 runner (in-memory Blob), extractor chain (mocked fetch), fact/synthesis parsing against recorded Claude responses. `scripts/prompt-harness.ts` regenerates prompts and checks new responses.
