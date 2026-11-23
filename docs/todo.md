# Backlog

Phases follow `docs/PRD.md`. Check items off as they're done; add new items where they belong. Newest discoveries go at the top of their section.

## Now: Phase 2 (script and checker), branch `phase2-v1`

Plan agreed 2026-11-23 (see `docs/decisions.md`, `docs/tone-guide.md`). Exit (PRD): scripts read well and pass the checker without manual edits for several consecutive runs.

- [ ] Episode profile (`RunParams`: categories "all" or % mix, rank / top-then-category order); `EpisodePlanner` picks from synthesized stories by word budget (~150 wpm).
- [ ] `ScriptWriter` + `ScriptChecker` per story in one step (write → check → rewrite once → drop); tone rules from `docs/tone-guide.md`; "recently" input switchable (off).
- [ ] Fixed intro/outro templates.
- [ ] `meetsFailurePolicy()` stub returning true.
- [ ] Storage: `runs/{id}/plan.json`, `runs/{id}/script.json`, `segments/{scriptHash}.json`.
- [ ] Opt-in "Write script (Phase 2)" button; `/debug/runs/<id>/script` page with full read-through, word counts, minutes, checker verdicts, per-segment 👍/👎 + notes, copyable report.
- [ ] Offline prompt tests with Claude stand-ins on fixtures; recorded responses as regression fixtures.
- [ ] User: fresh run → "Run analysis" → "Write script"; paste report into `docs/reviews/`.

## Now: Phase 0 exit (story discovery)

Exit criterion: about a week of daily manual runs where the ranked list looks like that day's real headlines.

- [ ] **Source coverage and quality** (review 2026-11-22 0528 scored 2/5: too few outlets per story). Most stories reach only 2–3 outlets.
  - [ ] Run feed discovery for every source on `/debug/feeds`; add matching section feeds (us, world, business, science, sports) per outlet where they exist; mark real front-page feeds `top`.
  - [ ] Remove or replace configured feeds that fail (several were guessed on 2026-11-22).
  - [ ] Low-volume outlets: The Nation (1/day), Mother Jones (4), HuffPost (4), CSM (6), Daily Wire (6), Daily Caller (10). Decide whether to add feeds, swap outlets, or add outlets (keep left/center/right roughly even).
  - [ ] Consider more sources overall (PRD: replacements if HuffPost/BBC/Breitbart fail; volume asymmetry is a known bias).
  - [ ] Download the edited `sources.json` from `/debug/feeds` and commit it once the feed set settles.
- [ ] **Fine-tune P and the headline index** (weights, P definition, min outlets, soft-news handling) from daily reviews; re-rank is free on saved runs:
  - [ ] **P fix (agreed, not started):** a 2-outlet story featured on one outlet's homepage ranks too high (sports crash, auction, UK village, Maher in run 0528) because P is a mean over covering outlets, so one featuring outlet out of two gives P ≈ 0.6. Plan: blend P with coverage so it can't lift thin stories, e.g. P' = P × min(1, distinctOutlets / k) with k≈4 in config, or sum of outlet prominence ÷ active outlets. Verify by re-ranking run 2026-11-22T0528-df1c2b (free) and comparing against the review in `docs/reviews/2026-11-22-0528.md`.
  - [ ] Politically significant 2–3 outlet stories rank too low (Schumer challenge, terror warnings, Congress access, Lutnick). Partly a volume problem; revisit after feed work.
  - [ ] Category assignment sometimes odd (FBI hack as us/science). Tighten category guidance in the clusterer prompt.
- [ ] Verify the homepage check works per outlet (Homepage column in Source health); for JS-rendered homepages, decide on a fallback.
- [ ] Daily runs for a week, each reviewed on `/debug/runs/<id>/review`; save each pasted report to `docs/reviews/`.
- [ ] Re-check AllSides ratings for the 10 unverified sources (BBC first).

## Now (parallel): Phase 1 (full text and story analysis): proof of concept working

First live run 2026-11-22 (`docs/reviews/2026-11-22-1313-analysis.md`): $0.24 for 15 stories; good syntheses where 2+ outlets have text. Opt-in via "Run analysis" on a run's Pipeline table. Goal now: MVP quickly, fine-tune later (every stage is swappable).

- [ ] Re-run analysis on a run after the 2026-11-22 fixes and confirm: no 429 errors, The Hill skipped cleanly, single-source facts labelled, headline-only stories not synthesized.
- [ ] NewsNation blocks some page fetches (3/7 HTTP 403). Watch; add to `analysis.skipPageFetch` if it gets worse.
- [ ] One-sided or single-outlet "disputes" still appear (e.g. both positions from one outlet). Decided 2026-11-22 to leave for now; revisit in prompt tuning.
- [ ] Tune `SYNTHESIZE_SYSTEM` / `ANALYZE_SYSTEM` from real output.
- [ ] Measure time per story step against the ~300s function limit.
- [ ] Retention: delete `cache/text/*` older than 30 days (PRD). Not built yet.
- [ ] Phase 1 exit (PRD): spot checks hold up against source articles; extraction succeeds for most articles from each source.
- [x] Fixes after first run: SDK retries 8× with backoff on 429 and 2 concurrent fact calls per story; The Hill marked headline-only (no page fetch); facts from one outlet split into `singleSourceFacts` (summary attributes them); stories with no facts skipped ("headlines only").
- [x] Extractor chain v2: feed text → JSON-LD articleBody → Readability → Defuddle → RSS summary.
- [x] Debug UI: ranking legend; per-stage columns on the runs list; Pipeline table with actions and results per step on the run page.
- [x] Scaffold, `chain` extractor, `haiku-facts-v1`, `sonnet-synthesis-v1`, story history summaries, analysis page.

## Later

- Failure policy: real thresholds in `meetsFailurePolicy()` (PRD: ≥8/12 sources, ≥5 checked stories) once sources are adequate. Stub returns true.
- "Already covered" tracking across episodes (needs an episode history); "recently" background into the script once story history is reliable.
- Intro/outro wording per profile once episodes are customizable.
- Phase 3: `TTSProvider` (edge-tts; Kokoro fallback), audio cache, `EpisodeAssembler`, private web player.
- Phase 4: Neon + Drizzle story bank, playlists. Phase 5: lean slider.
- Ops: automatic mode that chains stages on completion (rank → analysis → script → audio), then a daily trigger that only starts the first stage; 30-day retention cleanup for article text and non-vanilla audio.

## Done

- [x] 2026-11-22: Phase 0 pipeline (sources → fetch → cluster → rank) on Vercel Workflows, Blob storage, run API, debug pages.
- [x] 2026-11-22: Review page with verdicts and copyable report.
- [x] 2026-11-22: Graded prominence (homepage position + feed type), feed discovery admin page, Blob-editable sources.
- [x] 2026-11-22: Phase 0 snapshot branch `phase0-v1`; Phase 1 built on the integration branch (opt-in).
