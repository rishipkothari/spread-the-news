# Backlog

Phases follow `docs/PRD.md`. Check items off as they're done; add new items where they belong. Newest discoveries go at the top of their section.

## Now: Phase 2 (script and checker), branch `phase2-v1`

Plan agreed 2026-11-23 (see `docs/decisions.md`, `docs/tone-guide.md`). Exit (PRD): scripts read well and pass the checker without manual edits for several consecutive runs.

- [ ] **User: re-run "Write script" on run 2026-11-23T0146-25e3fa** (or a fresh run with "Re-run analysis" first, so disagreements get a significance level) and compare drops and the Jackson-style false contrasts with `docs/reviews/2026-11-23-0146-script.md`.
- [ ] **Episode length (later):** second script ran 16 min vs a 13 min target (2394 words vs 1950): the writer treats budgets loosely (lead 354/300, Delta 266/170). Options: make the budget a ceiling in `WRITE_SYSTEM` ("at most N words"), tighten the code length note from 1.5× to 1.2× budget, lower `storyWords`, or plan fewer stories. User: fine for now.
- [ ] **Rundown (later, optional):** short spoken labels (3–6 words) per story from synthesis instead of full titles, if "top three and more" isn't enough.
- [ ] **Who's who (watch):** regex over checked facts and headlines; misses roles phrased unusually and can't help when no story states the role. Web context lookup (wish list) is the fallback.
- [ ] **Backfill (short term, deliberately off):** replace dropped stories with the next-ranked analyzed ones. Off for now so drops stay obvious; add back once drop rates are low, still listing what was dropped.
- [x] 2026-11-23 after second live script: rundown lists the top three + "and more"; short attributed phrases allowed when paraphrase would distort; one-sided coverage stated plainly (no comparison line); vary the coverage line; per-run who's who (W… material).
- [x] **Second live script** (same run, after fixes): 10/10 kept, 0 dropped, $0.41, 16 min. → `docs/reviews/2026-11-23-0146-script-2.md`
- [x] 2026-11-23 after first live script: dispute significance (Phase 1), headlines as material, rewrites show source material, 3 full attempts (no patching or cutting), side labels only where the side matters, "Where accounts differ" in tone guide, drop banner/notice/report-first, precise "Not planned" reasons.
- [x] **First live script** (run 2026-11-23T0146-25e3fa): 7 kept, 3 dropped (ranks 1, 3, 4), $0.40, 10.3 min. Fresh run → "Run analysis" → "Write script" → read on `/debug/runs/<id>/script`, mark 👍/👎, copy the report to Claude; save it in `docs/reviews/`.
- [ ] Tune `WRITE_SYSTEM` / `CHECK_SYSTEM` and `docs/tone-guide.md` from live scripts (watch: checker too strict → many drops; too lenient → misses; coverage line quality).
- [ ] Measure cost and time per script step (estimate $0.30–0.50 per episode; ~300s function limit).
- [ ] Live-run the checker's own prompt through the harness (`check-script`) once an API run exists; record write/check responses as regression fixtures.
- [ ] Exit (PRD): scripts read well and pass the checker without manual edits for several consecutive runs.
- [x] Built 2026-11-23: episode profile (`RunParams` categories "all" / list / % mix; `rank` default, `top-then-category`); `word-budget-v1` planner; `neutral-v1` writer + `quote-trace-v1` checker per story (rewrite once, then drop) with code checks; outlet names scrubbed from material; fixed intro/outro; `meetsFailurePolicy()` (always ok, notes only); story bank `segments/`; "Write script" button and `/debug/runs/<id>/script` page with 👍/👎 + notes and copyable report; harness `script-prompts` / `check-script`.

## Next: Phase 3 (audio and delivery)

Plan: `docs/phase3-plan.md` (planned 2026-11-23, not built). Phase 3 only, no backlog items. Exit (PRD): a vanilla episode can be triggered and played on a phone end to end.

- [ ] `TTSProvider` interface + `edge-tts` and `stub` adapters; sentence chunking, retries.
- [ ] Audio cache by `audioKey`; `voice` stage (one step per segment); `assemble` stage (`mp3-concat`, pauses, duration, manifest).
- [ ] Run page: Voice/Assemble rows, "Make audio" button; `/debug/voices` voice test page.
- [ ] Player `/player` + `/player/[id]` (chapters, speed, resume, lock-screen controls); Range-capable `/audio/...` route.
- [ ] User: voice test on Vercel, pick a voice, make audio for a scripted run, play on phone; intro/outro wording.

## Now: Phase 0 exit (story discovery)

Exit criterion: about a week of daily manual runs where the ranked list looks like that day's real headlines.

- [ ] **Source coverage and quality** (review 2026-11-22 0528 scored 2/5: too few outlets per story). Most stories reach only 2–3 outlets.
  - [ ] Run feed discovery for every source on `/debug/feeds`; add matching section feeds (us, world, business, science, sports) per outlet where they exist; mark real front-page feeds `top`.
  - [ ] Remove or replace configured feeds that fail (several were guessed on 2026-11-22).
  - [ ] Low-volume outlets: The Nation (1/day), Mother Jones (4), HuffPost (4), CSM (6), Daily Wire (6), Daily Caller (10). Decide whether to add feeds, swap outlets, or add outlets (keep left/center/right roughly even).
  - [ ] Consider more sources overall (PRD: replacements if HuffPost/BBC/Breitbart fail; volume asymmetry is a known bias).
  - [ ] Download the edited `sources.json` from `/debug/feeds` and commit it once the feed set settles.
- [ ] **Grouping resilience: stale facts can reach the script.** Example (run 2026-11-23T0146, both script reviews): the clusterer made "Democrats win largest House majority since 1992 after North Carolina flip" (rank 4) and, separately, "Foxx concedes to Hubbard in North Carolina House race" (outside the analyzed top 15). The House story's facts said Rep. Virginia Foxx lost by 330 votes and *requested a recount*; the separate story says she *conceded*. The script passed the checker (the claim is supported by its own material) and would have aired an out-of-date fact. The cause is grouping, not the script: a direct follow-up became its own small story, ranked low, and was never analyzed.
  - [ ] Merge check: one cheap call after clustering over story titles + top headlines (and article times): "is any story the same event or a direct follow-up of another?" → merge into the larger story. Est. ~$0.01/run.
  - [ ] Newest development wins: when stories merge, pass article publish times to synthesis and tell it to prefer the latest development when facts conflict over time ("requested a recount" → "conceded"), noting the change if it matters.
  - [ ] Cheap backstop in Phase 2: when an unanalyzed story shares key names with a planned one, show it on the script page as "possibly newer development" for review.
  - [ ] Embeddings hybrid only if the above isn't enough (needs a non-Anthropic provider).
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
- **Fallback voice: Google Chirp 3 HD** (decided 2026-11-23; replaces Kokoro as the fallback). Waiting on the user: create a Google Cloud project, enable the Text-to-Speech API, create an API key restricted to it, add it in Vercel as `GOOGLE_TTS_API_KEY`. Then: `google-chirp3-hd` adapter behind `TTSProvider`, voices on `/debug/voices`, switch `methods.tts` in config. Check current pricing first (expected cents to tens of cents per episode).
- Phase 4: Neon + Drizzle story bank, playlists. Phase 5: lean slider = story *selection* only (presentation always all sides), disclosed on air; consider a shared core of top cross-spectrum stories.

## Wish list (long term)

- Web context lookup as a last resort for missing context (who someone is, what a thing is, official figures when outlets conflict): narrow, reference/official domains only, cited and labelled as background, never for framing; opt-in stage. Revisit only if drops stay high after the 2026-11-23 fixes.
- A "most contested stories" show format: episodes built from the stories where the sides disagree most, each presented with all sides.
- Ops: automatic mode that chains stages on completion (rank → analysis → script → audio), then a daily trigger that only starts the first stage; 30-day retention cleanup for article text and non-vanilla audio.

## Done

- [x] 2026-11-22: Phase 0 pipeline (sources → fetch → cluster → rank) on Vercel Workflows, Blob storage, run API, debug pages.
- [x] 2026-11-22: Review page with verdicts and copyable report.
- [x] 2026-11-22: Graded prominence (homepage position + feed type), feed discovery admin page, Blob-editable sources.
- [x] 2026-11-22: Phase 0 snapshot branch `phase0-v1`; Phase 1 built on the integration branch (opt-in).
