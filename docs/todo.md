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
  - [ ] 2-outlet stories with one outlet featuring them (sports crash, auction, UK village) rank too high: P from a single outlet carries too much. Options: blend P by coverage, require ≥3 outlets for full P, or raise C weight.
  - [ ] Politically significant 2–3 outlet stories rank too low (Schumer challenge, terror warnings, Congress access, Lutnick). Partly a volume problem; revisit after feed work.
  - [ ] Category assignment sometimes odd (FBI hack as us/science). Tighten category guidance in the clusterer prompt.
- [ ] Verify the homepage check works per outlet (Homepage column in Source health); for JS-rendered homepages, decide on a fallback.
- [ ] Daily runs for a week, each reviewed on `/debug/runs/<id>/review`; save each pasted report to `docs/reviews/`.
- [ ] Re-check AllSides ratings for the 10 unverified sources (BBC first).

## Next: Phase 1 (full text and story analysis)

- [ ] `ArticleTextExtractor` chain: feed content → fetch + Readability → headline-only; quality check (min length, paywall phrases); robots.txt; cache by URL; per-source success report.
- [ ] Story history: add synthesis summaries back into `history/stories-14d.json`; pass the linked chain to the synthesizer.
- [ ] `ArticleAnalyzer` (Haiku 5.5): facts with exact supporting quotes, news/analysis only.
- [ ] `StorySynthesizer` (Sonnet 5.5): agreed facts, disputed claims, framing by side, "recently" background.
- [ ] Debug/review views for extraction and synthesis output.

## Later

- Phase 2: `EpisodePlanner` (top-then-category), script prompt design, `ScriptWriter`, `ScriptChecker` (rewrite-then-drop).
- Phase 3: `TTSProvider` (edge-tts; Kokoro fallback), audio cache, `EpisodeAssembler`, private web player.
- Phase 4: Neon + Drizzle story bank, playlists. Phase 5: lean slider.
- Ops: cron trigger (thin route over `startRun`); 30-day retention cleanup for article text and non-vanilla audio.
- Housekeeping: log this project in the stack playbook's `projects.md` (needs access to `rishipkothari/dev-stack-playbook`).

## Done

- [x] 2026-11-22: Phase 0 pipeline (sources → fetch → cluster → rank) on Vercel Workflows, Blob storage, run API, debug pages.
- [x] 2026-11-22: Review page with verdicts and copyable report.
- [x] 2026-11-22: Graded prominence (homepage position + feed type), feed discovery admin page, Blob-editable sources.
