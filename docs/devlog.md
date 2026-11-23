# Dev log

One entry per work session, newest first: what changed, what we learned, what's next.

## 2026-11-23: Phase 2 planning

**Agreed with the user** (details in `docs/decisions.md`; tone rules in the new `docs/tone-guide.md`)
- Style: straight news plus one tasteful coverage line; light and relatable (Gen Alpha enjoys, millennials take seriously).
- No outlet names on air (sides only); every story told fresh; no direct quotes; nameless narrator; fixed intro/outro.
- Episode profile generalizes `RunParams`; generic = defaults; straight rank order.
- Writer and checker per story in one step, rewrite once then drop; checker also enforces tone.
- Failure policy: function exists, returns true for now.
- Opt-in button now; completion-based automation later.
- Branch `phase2-v1` from `main` (= `phase1-v1`).

**Built** (same session)
- `plan` stage: `word-budget-v1` (profile categories "all" / list / % mix; `rank` or `top-then-category`; lead 300 words, others 170, scaled to target, never padded).
- `script` stage, one step per story: `neutral-v1` writes from numbered material (facts, disputes by side, framing by side), `quote-trace-v1` maps claims to material ids and lists tone issues; code checks for outlet names, read-aloud problems and length; code decides pass; one rewrite with the checker's notes, then drop.
- Fixed intro/outro from config; `meetsFailurePolicy()` always ok (notes what would fail); kept segments saved to `segments/`.
- "Write script" button; `/debug/runs/<id>/script` page with checker details, first drafts, dropped stories, 👍/👎 + notes, copyable report.
- `tests/script.test.ts` (20 tests) incl. tone-guide sync; harness `script-prompts` / `check-script`.

**Learned**
- Phase 1 framing and dispute text names outlets ("Mother Jones frames…"), which would leak into scripts. Material now replaces names with sides; the code check is the backstop.
- A sample segment written offline from the fixture prompt (`tests/fixtures/script/sample-segment.txt`, 266 words) passes the code checks. Not verified: real Sonnet writing/checking, cost, timing.

**Next**
- User: fresh run → "Run analysis" → "Write script", review on the script page, paste the report.
- Then: tune prompts and the tone guide from real scripts.

## 2026-11-22 (afternoon): first live Phase 1 run, fixes, UI tidy

**First live analysis** (run `2026-11-22T1313-32021b`, review saved): $0.24 for 15 stories. Extraction full for most outlets; The Hill 0/11 and NewsNation 3/7 blocked (HTTP 403). Syntheses strong with 2+ outlets: caught real discrepancies (cartel affiliation, death toll, player position). Problems: 3 × 429 concurrency errors; one-outlet facts labelled "agreed"; a headlines-only story got a "no facts" summary.

**Changed** (user approved 1–3 and 5; not 4)
- 429: SDK retries 8×; 2 concurrent fact calls per story.
- The Hill headline-only (no page fetch).
- `singleSourceFacts`; summary attributes one-outlet facts.
- Skip synthesis for stories with no facts.
- Extractor chain v2 adds JSON-LD articleBody and Defuddle around Readability.
- UI: ranking legend; per-stage columns on runs list; Pipeline table on run page (step, state, time, result, cost, action, view).

**Next**: user re-runs analysis to confirm the fixes; then MVP push (Phase 2 script), with P/headline-index tuning ongoing.

## 2026-11-22 (evening): Phase 1 built (opt-in), awaiting first live run

**Built**
- Branch `phase0-v1` snapshots Phase 0. Phase 1 lives on the integration branch, opt-in via "Run analysis (Phase 1)".
- Fan-out: plan → one workflow step per story → merge, for extract, analyze, synthesize. Units write their own files, merge writes usage/status (no races).
- `chain-v1` extractor (feed text → Readability via linkedom → RSS summary) with quality check, robots.txt, URL cache, per-source report.
- `haiku-facts-v1` (verbatim-quote verified) and `sonnet-synthesis-v1` (fact-id citations resolved in code). Refusal fallback only requested for Sonnet/Opus (Haiku has none).
- `/debug/runs/<id>/analysis` page with copyable report. History entries now carry `continuesStoryId` and synthesis summaries.

**Prompt testing (offline)**
- No API key in the sandbox, so Claude sub-agents stood in for the API on a fictional 4-outlet story (`tests/fixtures/analysis/story-stopgap.json`). Haiku: 43 facts, 0 non-verbatim quotes; loaded framing correctly excluded or attributed. Sonnet: 0 unresolved ids, neutral summary, fair framing.
- First synthesis found only 1 dispute; prompt revised to name three kinds of disagreement → 3 real disputes on retest. Added a rule against "reported without comment" as a position.
- Recorded responses are regression fixtures in `tests/fixtures/analysis/responses/`.

**Not verified** (needs the user on Vercel): real page fetches/Readability on live sites, real API calls and cost, step timing.

**Next**
- User: run analysis on a finished run, paste the analysis report.
- Then: tune prompts from real output; P fix (todo); Phase 2 planning.

## 2026-11-22: Phase 0 built, first live runs

**Built**
- Next.js 16 + Workflow SDK scaffold; stages `sources → fetch → cluster → rank`; every stage's output in Blob; run API with replay and single-stage re-runs.
- Debug pages, browser buttons for runs (user is non-technical), review page with verdicts and "Copy report for Claude".
- Graded prominence: homepage positions + feed types (`top`/`latest`/`section`). Admin `/debug/feeds` page: feed discovery, add/remove/retype feeds, Blob-editable source list.
- Housekeeping: `CLAUDE.md` (thin) + `docs/` (this log, todo, decisions, architecture, stack, PRD, reviews).

**Deploy issues hit**
- Vercel project was created before code, so it had "Other" framework → "No Output Directory named public". Fixed with `vercel.json` (`framework: nextjs`) and the dashboard setting.
- Structured outputs rejected zod's `int()` min/max → `sanitizeSchema()` strips unsupported keywords; 4xx errors made non-retryable.

**Runs**
- Feed check: 11/12 sources ok.
- Run `2026-11-22T0459-f8265f` (re-cluster): 235 articles, 7 ranked, user 5/5 on quality but too few stories. Fixes: min outlets 2, more feeds, merge-reactions prompt rule. → `docs/reviews/2026-11-22-0459.md`
- Run `2026-11-22T0528-df1c2b`: 12/12 sources, 265 articles, 25 ranked, $0.10, cluster 17s. User 2/5: too few outlets per story; 2-outlet stories featured by one outlet rank too high; significant political stories too low. → `docs/reviews/2026-11-22-0528.md`

**Learned**
- Clustering is cheap and fast (~$0.09–0.10, <20s) with good grouping quality.
- The bottleneck is source volume/coverage: feeds carry only their last 10–25 items, and several outlets publish little.

**Next**
- User: run feed discovery on `/debug/feeds`, add matching section feeds, then resume daily reviewed runs.
- Claude: tune P so a single featuring outlet can't lift a 2-outlet story (see todo), then start Phase 1.
