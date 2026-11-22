# Backlog

Phases follow `docs/PRD.md`. Check items off as they're done; add new items where they belong. Newest discoveries go at the top of their section.

## Now: Phase 0 exit (story discovery)

Exit criterion: about a week of daily manual runs where the ranked list looks like that day's real headlines.

- [ ] **Source coverage and quality** (review 2026-11-22 0528 scored 2/5: too few outlets per story). Most stories reach only 2–3 outlets.
  - [ ] Run feed discovery for every source on `/debug/feeds`; add matching section feeds (us, world, business, science, sports) per outlet where they exist; mark real front-page feeds `top`.
  - [ ] Remove or replace configured feeds that fail (several were guessed on 2026-11-22).
  - [ ] Low-volume outlets: The Nation (1/day), Mother Jones (4), HuffPost (4), CSM (6), Daily Wire (6), Daily Caller (10). Decide whether to add feeds, swap outlets, or add outlets (keep left/center/right roughly even).
  - [ ] Consider more sources overall (PRD: replacements if HuffPost/BBC/Breitbart fail; volume asymmetry is a known bias).
  - [ ] Download the edited `sources.json` from `/debug/feeds` and commit it once the feed set settles.
- [ ] **Ranking tuning** from reviews (re-rank is free on saved runs):
  - [ ] **P fix (agreed, not started):** a 2-outlet story featured on one outlet's homepage ranks too high (sports crash, auction, UK village, Maher in run 0528) because P is a mean over covering outlets, so one featuring outlet out of two gives P ≈ 0.6. Plan: blend P with coverage so it can't lift thin stories, e.g. P' = P × min(1, distinctOutlets / k) with k≈4 in config, or sum of outlet prominence ÷ active outlets. Verify by re-ranking run 2026-11-22T0528-df1c2b (free) and comparing against the review in `docs/reviews/2026-11-22-0528.md`.
  - [ ] Politically significant 2–3 outlet stories rank too low (Schumer challenge, terror warnings, Congress access, Lutnick). Partly a volume problem; revisit after feed work.
  - [ ] Category assignment sometimes odd (FBI hack as us/science). Tighten category guidance in the clusterer prompt.
- [ ] Verify the homepage check works per outlet (Homepage column in Source health); for JS-rendered homepages, decide on a fallback.
- [ ] Daily runs for a week, each reviewed on `/debug/runs/<id>/review`; save each pasted report to `docs/reviews/`.
- [ ] Re-check AllSides ratings for the 10 unverified sources (BBC first).

## Now (parallel): Phase 1 (full text and story analysis): built, awaiting first live run

Built 2026-11-22 on the integration branch, opt-in via "Run analysis (Phase 1)" on a finished run. Prompts tested offline with Claude sub-agents on a fictional fixture story; nothing has hit the real API or real news pages yet.

- [ ] **First live run (user):** open a finished run → "Run analysis (Phase 1)" → wait for the three stages → "Analysis →" → copy the report and paste it to Claude. Expected cost ≈ $0.30–0.60 for 15 stories.
- [ ] Check the extraction table: which outlets block page fetches (403/robots/paywall)? Decide per outlet: accept headline-only, find a better feed with full text, or drop.
- [ ] Check facts: quotes should all be verbatim (non-verbatim ones are dropped and noted in usage). Watch the "dropped" notes on the run page's usage.
- [ ] Check syntheses: agreed facts really agreed, disputes real, framing fair. Tune `SYNTHESIZE_SYSTEM` / `ANALYZE_SYSTEM`; re-run analysis in place (text is cached, so re-runs mostly cost LLM tokens).
- [ ] Measure time per stage; if a story step nears the ~300s function limit, lower `analysis.maxArticlesPerStory` or concurrency.
- [ ] Retention: delete `cache/text/*` older than 30 days (PRD). Not built yet.
- [ ] Phase 1 exit (PRD): spot checks of synthesis hold up against source articles; extraction succeeds for most articles from each source.
- [x] Scaffold: stages extract → analyze → synthesize, one workflow step per story, merge; history chain links.
- [x] `chain-v1` extractor (feed text → Readability → RSS summary), quality check, robots.txt, URL cache, per-source report.
- [x] `haiku-facts-v1` with verbatim-quote verification; `sonnet-synthesis-v1` with fact-id citations resolved in code.
- [x] Story history: synthesis summaries written back; linked chain passed to the synthesizer.
- [x] `/debug/runs/<id>/analysis` page with copyable report.

## Later

- Phase 2: `EpisodePlanner` (top-then-category), script prompt design, `ScriptWriter`, `ScriptChecker` (rewrite-then-drop).
- Phase 3: `TTSProvider` (edge-tts; Kokoro fallback), audio cache, `EpisodeAssembler`, private web player.
- Phase 4: Neon + Drizzle story bank, playlists. Phase 5: lean slider.
- Ops: cron trigger (thin route over `startRun`); 30-day retention cleanup for article text and non-vanilla audio.

## Done

- [x] 2026-11-22: Phase 0 pipeline (sources → fetch → cluster → rank) on Vercel Workflows, Blob storage, run API, debug pages.
- [x] 2026-11-22: Review page with verdicts and copyable report.
- [x] 2026-11-22: Graded prominence (homepage position + feed type), feed discovery admin page, Blob-editable sources.
- [x] 2026-11-22: Phase 0 snapshot branch `phase0-v1`; Phase 1 built on the integration branch (opt-in).
