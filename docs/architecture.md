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

Stages (`src/pipeline/stages.ts`): `sources → fetch → cluster → merge → rank` (discovery; a plain run stops here; `merge` joins stories the clusterer split, "Run merge check" re-runs merge + rank on older runs), `extract → analyze → synthesize` (Phase 1, started separately with "Run analysis") `plan → script` (Phase 2, started separately with "Write script"; `startScript` in `src/pipeline/start.ts`) and `voice → assemble` (Phase 3, "Make audio"; `startAudio`). Phase 1 stages fan out: `planUnits` picks the top stories and one article per covering outlet (`pickArticles`, capped by `analysis.maxArticlesPerStory`) and writes `analysis-plan.json`, `runUnit` runs once per story as its own workflow step (writing `runs/{id}/{stage}/{storyId}.json`), and `mergeStage` combines units into `runs/{id}/{stage}.json` and records usage and status (`src/pipeline/phase1.ts`). Phase 2: `plan` is a plain stage (`run.ts`); `script` fans out one step per planned story through `src/pipeline/phase2.ts` (`planScriptUnits` → `runScriptUnit` → `mergeScript`; `steps.ts` dispatches by stage). Each script unit writes and checks up to `script.maxAttempts` (3) full times, each rewrite getting the checker's notes plus the exact material lines for flagged claims, then keeps or drops the story (never patched or cut). `mergeScript` adds the fixed template segments (`welcome`, `rundown`, `outro`, each switchable in `config/pipeline.json → script.templates`), applies `meetsFailurePolicy()` (`src/pipeline/policy.ts`, suspended: always ok, notes only) and writes `script.json`. The episode profile (`RunParams`) is set when the script is started (generic = config `vanilla`). Phase 3 (`src/pipeline/phase3.ts`): `voice` fans out one step per script segment, `audio.concurrency` (3) at a time (`planVoiceUnits` → `runVoiceUnit` → `mergeVoice`); each unit voices its text once per `audioKey = hash(provider, format, voice, text)` into `audio/{audioKey}.mp3` (cache hit = no TTS call). `mergeVoice` applies the audio failure policy (`voicePolicy`: a fixed segment failing, or more than `audio.maxStoryFailShare` of stories, fails the stage; otherwise failed stories are left out). `assemble` is a plain stage (`assembleEpisode`) that joins the segment MP3s in script order with silent pauses (`src/audio/mp3.ts`) and writes the episode. **Versions** (`src/pipeline/versions.ts`): when a phase's last stage finishes (`synthesize`, `script`, `assemble`; hooked in `src/workflows/steps.ts`), its files are copied to `runs/{id}/versions/{phase}/{n}/` and recorded in `runs/{id}/versions.json`. The working files are always the current version, so stages and pages read them unchanged; `startAnalysis/startScript/startAudio` call `prepareRerun` first (saves pre-versions output as v1, syncs the script review into its version and clears it), and `activateVersion` copies a snapshot back (run page "Versions" table, `?v=n` on the analysis and script pages). Episodes are `{runId}-a{n}`. Each reads the previous stages' saved JSON, so any stage can be re-run alone (`POST /api/runs/:id/stages/:stage`, "Re-rank") or a new run can start mid-pipeline from another run's outputs (`replayFrom`, "Re-cluster").

## Swappable stages

`src/stages/types.ts` defines one interface per stage. Implementations live in `src/stages/<stage>/<id>.ts` and are registered in `src/stages/registry.ts`; `config/pipeline.json → methods` picks one by id. To add an implementation: write it against the interface, register it, switch the id in config.

| Stage | Interface | Implementation | Notes |
| :- | :- | :- | :- |
| sources | `SourceRegistry` | `blob-json` (default), `static-json` | `src/sources/store.ts` holds the Blob-editable list |
| fetch | `ArticleFetcher` | `rss` | `normalize.ts` (parse, dates, URLs, dedupe), `robots.ts`, `homepage.ts` (homepage positions) |
| cluster | `StoryClusterer` | `llm-single-pass` | `prompt.ts`; one Sonnet call, zod-validated via `src/lib/llm.ts structuredCall()` |
| merge | `StoryMerger` | `llm-merge-v1` (default), `none` | one Sonnet call over titles, newest headlines and times; `applyMerges` validates groups and keeps the larger story |
| rank | `StoryRanker` | `headline-index-v1` | pure function of saved signals; weights in config; ranks `merge.json` stories (falls back to `cluster.json`) |
| extract | `ArticleTextExtractor` | `chain-v3` (default), `feed-only` | feed text → JSON-LD → Trafilatura (`api/trafilatura.py`, a Vercel Python function; skipped if unreachable) → Readability → Defuddle → RSS summary; `skipPageFetch` outlets go straight to headline-only; runner caches by URL |
| analyze | `ArticleAnalyzer` | `haiku-facts-v1` (default), `stub` | facts with verbatim quotes, verified in code |
| synthesize | `StorySynthesizer` | `sonnet-synthesis-v1` (default), `stub` | cites fact ids; `resolveSynthesis` maps them to quotes |
| plan | `EpisodePlanner` | `word-budget-v1` | pure; picks synthesized stories by profile (categories "all" / list / % mix), orders by `orderStrategy` (`rank` default, `top-then-category`), word budgets at 150 wpm, never pads |
| script | `ScriptWriter` | `neutral-v1` (default), `stub` | one segment per story from `material.ts` (numbered facts F1…, material disputes D1a… (minor ones excluded), headlines H1…, who's who W1… (`whoswho.ts`: role phrases from the whole run), framing FR-side; outlet names replaced by sides); tone rules from `tone.ts` = `docs/tone-guide.md` Rules (test-enforced) |
| tts | `TTSProvider` | `edge-tts` (default), `stub` | `msedge-tts` package; text XML-escaped and split at sentences (`src/audio/text.ts`); all output 24 kHz 48 kbps mono MP3 so segments join exactly; `voices()` feeds `/debug/voices` |
| assemble | `EpisodeAssembler` | `mp3-concat` | pure; frame-level join, tags/Xing frames dropped, pauses from silent frames, duration from frame count |
| check | `ScriptChecker` | `quote-trace-v1` (default), `stub` | claims → material ids + tone issues; code decides pass (`checks.ts verdict`) and adds deterministic checks (outlet names, parentheses, URLs, read-aloud quotes, length note) |

`src/lib/llm.ts` is the single place that calls Claude: streaming, structured output (schema sanitized for the API), one retry on invalid output, refusal fallback, usage and cost.

## Storage (Vercel Blob, private store)

```
runs/{runId}/status.json      run state, per-stage state and summaries, errors
runs/{runId}/{stage}.json     each stage's output (sources, fetch, cluster, rank)
runs/{runId}/merge.json       merge check: stories after merging, merges made (titles, reason)
runs/{runId}/bundle.json      StoryBundle after ranking
runs/{runId}/versions.json    analysis/script/audio versions and which is current
runs/{runId}/versions/{phase}/{n}/…  snapshot of a phase's files (same names as the working files)
runs/{runId}/usage.json       tokens, cost, ms per stage
runs/{runId}/review.json      the user's review (verdicts) from the review page
runs/{runId}/analysis-plan.json  Phase 1: chosen stories and articles
runs/{runId}/{stage}/{story}.json Phase 1 per-story unit outputs
history/stories-14d.json      rolling story index for cross-day linking (+ synthesis summaries)
runs/{runId}/plan.json        Phase 2: episode plan (profile, stories, word budgets, skipped + why)
runs/{runId}/script/{story}.json  Phase 2 per-story unit: every draft, its check, kept segment or drop reason
runs/{runId}/script.json      Phase 2: the episode script (intro + segments + outro, dropped, words, policy notes)
runs/{runId}/script-review.json  the user's 👍/👎 and notes from the script page
runs/{runId}/voice-plan.json  Phase 3: provider, voice, format, segment ids
runs/{runId}/voice/{segment}.json  Phase 3 per-segment voicing: audioKey, seconds, cached, error
runs/{runId}/voice.json       Phase 3: all segments' voicing results
runs/{runId}/assemble.json    Phase 3: episode id, duration, segments left out
audio/{audioKey}.mp3          voiced segment (cache; voice tests share it)
episodes/{runId}-a{n}.json   episode manifest per audio version: chapters, voice, run, versions, missing segments (older: {date}-{paramsHash})
episodes/{runId}-a{n}.mp3    episode audio
news/index.json               public news: every published day, newest first (src/news/store.ts)
news/days/{date}.json         public news: the day's story rows, section counts, episode tracks; the run with the most done wins (publishRun)
news/stories/{date}-{storyId}.json  public news: one story page (script paragraphs, analysis, outlets, track)
admin/voice-test.json         last test from /debug/voices
segments/{scriptHash}.json    story bank: every kept story segment with its checker result
cache/text/{urlHash}.json     extracted article text (full/partial only)
config/sources.json           live source list edited on /debug/feeds (overrides the repo file)
config/sources-changelog.json edits made on /debug/feeds
admin/discovery/{source}.json last feed-discovery results per source
```

`src/lib/storage.ts` wraps Blob (`putJson`, `getJson`, `putBytes`, `getBytes`, `sizeOf`, `getRange`, `listPaths`, `paths`).

## Web

Two route groups (neither changes URLs). **Public site** `app/(site)/`: its layout holds the header, the page and the player (`_components/player.tsx`: queue, position and speed saved per device, Media Session lock-screen controls; `_components/Drawer.tsx`: the slim bar at the bottom while something is queued, pulled up into the full player and queue). Pages read the prebuilt news data (`src/news/store.ts`); earlier days load on scroll from `/data/news/{date}`. Soft corners, light shadows: `app/(site)/site.css`. **Admin console** `app/(admin)/` (`layout.tsx`, `AdminNav.tsx`): sidebar on desktop, tab strip on phones, sharp corners and hairlines. Shared: tokens and admin styles in `app/globals.css` (light and dark via `html[data-theme]`, set before paint in `app/layout.tsx`: device setting until the visitor toggles), icons and the theme switch in `app/_ui/`. Fonts: Newsreader, Inter, JetBrains Mono. Brand images in `public/brand/`; design notes from Stitch in `docs/stitch.md`.

Local preview only: `LOCAL_BLOB_DIR=/folder` makes `getJson`/`putJson`/`listPaths` use files in that folder instead of Blob (ignored on Vercel).

| Route | What |
| :- | :- |
| `/` | landing: brand, way into the news, the day's top three stories, daily episode button |
| `/news`, `/news/[section]` | news home and section pages: section chips, date ‹ › with calendar, daily episode (home), Play this section (5/10/15 min), story rows, earlier days on scroll; `?date=YYYY-MM-DD` |
| `/story/[id]` | story page: headline, summary, coverage split, Play / Add to queue, the script, "How the coverage compares", "Who covered it" |
| `/debug` | admin console overview: start runs, latest run and episode, links |
| `/player`, `/player/[id]` | episode list; player (chapters, −15/+15, speed, resume per device, lock-screen controls via Media Session) |
| `/audio/[...key]` | streams `audio/*.mp3` and `episodes/*.mp3` from private Blob with HTTP Range, ≤ `audio.rangeChunkBytes` per response (`src/audio/range.ts`) |
| `/debug/voices` | voice test: pick a voice, voice a real story segment, play it |
| `/debug/runs`, `/debug/runs/[id]` | start runs; run status, source health, ranked stories, re-cluster / re-rank |
| (all `/debug/runs/[id]/*`) | `RunNav`: "← Run" button and tabs between ranking review, analysis, script, episode |
| `/debug/runs/[id]/review` | verdicts per story, autosaved; "Copy report for Claude" (`src/review/report.ts`) |
| `/debug/runs/[id]/analysis` | Phase 1 output: extraction by source, syntheses with quotes, copyable report |
| `/debug/runs/[id]/script` | Phase 2 output: full script, checker verdicts and claims, first drafts, dropped stories, plan, 👍/👎 + notes per segment (autosaved), copyable report (`src/review/script-report.ts`) |
| `/debug/feeds` | feed discovery and source editing: overview table, one card per source, batch "Add all active found feeds" (`src/admin/feed-plan.ts`), "Add them" for repo sources missing from the live list (`src/admin/discover.ts`, `app/(admin)/debug/feeds/actions.ts`) |
| `/data/news`, `/data/news/[date]`, `/data/story/[id]` | public news data as JSON (index; day + older/newer days; story page), built by `src/news/` |
| `/api/runs…` | Bearer-authenticated API (see README) |

Auth: `proxy.ts` gates every non-API page with Basic auth (`PLAYER_PASSWORD`); API routes check `Bearer RUN_SECRET` (`src/lib/auth.ts`). Workflow's `/.well-known/workflow/*` routes are excluded from the proxy.

## Public news data

`src/news/build.ts` `buildNews()` (pure) turns a run's bundle, synthesis, script, voice output and episode into story rows (`NewsStoryCard`), story pages (`NewsStory`) and the day (`NewsDay`); types in `src/news/types.ts`. `src/news/store.ts` `publishRun()` writes them; `publishAfterStage()` runs after rank, synthesize, script and assemble (`src/workflows/steps.ts`, never fails a stage), and after "Use this version". A run replaces its day's published run only with at least as much progress, unless forced ("Publish to news"). `rebuildAllNews()` republishes every run. `src/news/queue.ts` `pickForLength()` picks "Play this section" tracks. Story tracks are the cached segment audio (`/audio/audio/{key}.mp3`).

## Tests

`tests/` runs with vitest against fixtures (the sandbox can't reach news sites): feed parsing and normalization, robots.txt, ranking on `tests/fixtures/bundle-synthetic.json` (regenerate with `npx tsx scripts/make-fixture-bundle.ts`), cluster-output validation, schema sanitizing, homepage matching, feed discovery, review report, Phase 1 runner (in-memory Blob), extractor chain (mocked fetch), fact/synthesis parsing against recorded Claude responses, Phase 2 planner/material/checks/runner (`tests/script.test.ts`, including the tone-guide sync check), merge check (`tests/merge.test.ts`), versions (`tests/versions.test.ts`), public news data: rows, story pages, episode tracks, publishing rule, section picker (`tests/news.test.ts`), Phase 3 MP3 parsing/joining, text chunking, Range handling, chapters and the voice/assemble runners with a stub TTS (`tests/audio.test.ts`). `scripts/prompt-harness.ts` regenerates prompts and checks new responses (`script-prompts` / `check-script` for Phase 2).
