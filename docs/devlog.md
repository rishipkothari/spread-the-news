# Dev log

One entry per work session, newest first: what changed, what we learned, what's next.

## 2026-11-28: intro page and logo link

**Asked**: a place to redo the intro (the show is PRISM News now, new tagline), and the logo should go to the landing page from everywhere.

**Built**: `/debug/show` ("Intro" in the admin nav). It edits the welcome, rundown (`{stories}`) and sign-off, saved to Blob (`config/show-text.json`, `src/show/store.ts`) with `config/pipeline.json` as the default. "▶" voices a saved line in the episode voice through the episode's audio cache and code rules, so it's already voiced for the next episode. "Use on this run" calls `refreshFixedSegments`: it swaps the fixed lines in an existing script without rewriting stories (no LLM), and then the user re-makes audio. `mergeScript` uses the saved lines. Default lines and the writer/checker prompts now say "Prism News": the listening test showed the voice spells out capitals, so spoken text avoids "PRISM". Admin and site logos link to `/`. Test added (174 total). Checked here: typecheck, tests, `next build`.

## 2026-11-27: outlets may be named in the script

**Read**: feedback issue #19 (ranking review, run 2026-11-27T1823-ccdf88). The #2 story, "Nvidia chips reach China; Huang and Lutnick face scrutiny", was dropped from the script after three drafts for naming an outlet: Bloomberg, whose scoop the articles credited. Our material replaced only our own 27 outlet names with sides, so "Bloomberg" reached the writer, the AI checker rejected it every time, and no side label fits an outlet we don't follow. Review saved as `docs/reviews/2026-11-27-1823-ranking.md`.

**Decided** (user): outlet names are fine ("reporting the reporting"). Credit them in parentheses after the side, any outlet allowed. Backlog: clickable inline citations on the site.

**Changed**: the material no longer swaps names for sides. It labels facts, positions, headlines, framing and coverage with side plus on-air name ("one right-leaning outlet (Fox News)"; "The Guardian (US)" becomes "The Guardian"). Writer prompt: credit by name in parentheses. Checker prompt: `outlet_named` removed; `attribution` now also covers an outlet named under the wrong side or credited with what it didn't report. Code checks: the outlet-name check is gone. A new wrong-side check covers our own outlets. Parentheses are allowed only around a short list of names. Spoken pass: "(HuffPost, Vox)" is read as ", HuffPost and Vox," (401(k) untouched). Tone guide "Outlets and sides" and "Written for the ear" rewritten, plus an addendum row. Tests updated (outlet names, wrong side, spoken aside). Checked here: typecheck, 172 tests, `next build`.

**Next**: the user rewrites the script for run 2026-11-27T1823 and checks the Nvidia story and how the credits read.

## 2026-11-26: listening test results

**Read**: feedback issue #16 (pronunciation test v1, 115 of 118 versions marked). Saved as `docs/reviews/2026-11-26-pronunciation-test-v1.md`; findings and a rule per kind in `docs/pronunciation.md`.

**Learned**: every SSML clip failed on the free Edge endpoint (plain text only). Capitals inside respellings get spelled out as letters ("per-FECT", "WUSS-ter"); lowercase real-word respellings work ("pur-fect", "led"). The voice gets most news text right as written (US, NATO, NAACP, Buttigieg, Kyiv, Qatar, 52-48, F-35, 401(k), AT&T, xAI) and our rewrites broke many of them, so the spoken pass must be conservative: fix a short list of known failures (heteronyms like lead, WHO, Sen./R-Texas, units and symbols, ET, $1.2B, diacritics, garden-path commas, caps for emphasis, a few foreign names) and leave everything else. The intro's "read" is meant as "reed", which is what the voice already says.

**Fixed**: the "Send to Claude" note box was cut off on a narrow phone (it hung off the left edge when the button wrapped); on screens up to 640 px it now sits at the top of the screen.

**Built** (same day, plan agreed): the spoken script. New `speak` stage at the start of "Make audio": code rules (`src/audio/spoken.ts`), then one Sonnet call returning find/replace edits (`src/stages/speak/sonnet-spoken-v1.ts`), checked in code (no markup, no capitals inside respellings, words the test showed are read right stay untouched); welcome/outro rules only; Claude failure → rules only. `speak.json` per run (part of the audio version); the voice reads the spoken text; the script page shows "What the voice reads differently". Run page: "Make audio" moved to the speak row, "Changes →" link. Tests: `tests/spoken.test.ts` (15). Checked here: typecheck, 171 tests, `next build`.

**Next**: user makes audio on a scripted run and listens for the listed changes and the open cases.

## 2026-11-25: pronunciation listening test

**Built** (branch `listening-test`): "Pronunciation test" on `/debug/voices`. 38 short news lines covering the 20 categories in `docs/pronunciation.md`, each in 2–6 versions: as written, respelling styles (per-FECT / perFECT / pur-fect, U.S. / U S / U-S / you-ess…), written-out forms, and SSML tags (IPA `<phoneme>`, `<sub>`, `<say-as>`, `<break>`, `<emphasis>`) to learn whether the free Edge endpoint honors them. Clips voice on demand or with "Prepare all clips" (3 at a time, cached in `audio/`); a refused tag shows as a failure and goes in the report. Marks and notes stay in the browser until sent. `TTSProvider.synthesizeMarkup` (optional; edge-tts passes the fragment unescaped). Tests: `tests/pronunciation-test.test.ts`.

**Next**: user takes the test and sends it; then plan the spoken script on its own branch.

## 2026-11-25: feedback to Claude; pronunciation planned

**Discussed**: TTS mispronunciations (heard: "read" in the intro, "perfect" in a story, names, "US" choppy). Agreed: no manual list, no approvals, no rewording; a Claude pass writes a separate spoken script. The 20 categories it must catch are in `docs/pronunciation.md`. I can't listen to audio, and this sandbox can't reach Edge TTS or Whisper's model host (the user declined widening the network), and speech-to-text can't hear stress or "reed"/"red" anyway, so a one-time listening test by the user settles what Edge reads well.

**Built**: "Send to Claude" (`src/feedback/`, `app/_feedback/`): pages send their report plus a note as a GitHub issue (labels `feedback`, `feedback:<area>`; same-key sends become comments while open; long bodies continue in comments; logged in Blob). On the ranking review, analysis, script and run pages, a "Note to Claude" card on `/debug`, and "Flag this moment" in the player (track, second, the sentence probably playing, the segment text). Sends require the page password. Copy buttons kept as secondary. CLAUDE.md: read open feedback issues at the start of every session.

**Checked here**: typecheck, 152 tests (new `tests/feedback.test.ts` with a fake GitHub), `next build`; the `/debug` card in a browser (reaches the send and reports the missing token).

**Next**: user adds `GITHUB_FEEDBACK_TOKEN` in Vercel (done before merging) and sends a test note; then the pronunciation listening test and the spoken-script pass.

## 2026-11-25: run buttons

**Player bar** (follow-up): floating card on phones with the brand tile (shows a playing indicator) and a faint left-center-right progress line, so it reads as its own object without being louder.

**Built**: "Create run" (record only, state `created`, nothing runs; the run page shows "Find stories" and "Run full pipeline") and "Run full pipeline" (sources through assemble in one workflow) on `/debug` and `/debug/runs`. `createRun` / `startCreatedRun` in `src/pipeline/start.ts`; `tests/start.test.ts`. API unchanged (`POST /api/runs` still stops after rank by default).

**Next**: user tries "Run full pipeline" once and pastes "Copy time and cost for Claude" (first measured full run).

## 2026-11-25: frontend-stitch-1, the whole site rebuilt from Stitch

**Imported** from the Stitch project (design system, News Page, Story Detail & Framing Analysis, Landing, Simple Audio Drawer, admin screens): `docs/stitch.md`. The user supplied the glasses image and the light prism photo (`public/brand/`).

**Decided with the user**: theme follows the phone with a toggle; soft corners on the public site, sharp in admin; only three public screens (landing, news, story); sections are chips, no bottom tabs, no "saved" yet; the only player is the drawer; nothing technical in the public copy (no file sizes, methods, version numbers).

**Built**: public site in `app/(site)/` (landing, news home and sections with date navigation and infinite scroll, story page, the player drawer with queue, reorder, speed, lock-screen controls, saved queue); admin console restyled (sharp, hairlines, icons, theme switch); new fonts and tokens; favicon from the glasses image. `LOCAL_BLOB_DIR` for local previews with sample data.

**Checked here**: typecheck, 132 tests, `next build`; screenshots with sample data (phone and desktop, light and dark: landing, news, section, story, unvoiced story, drawer, admin). Audio playback itself can't be checked here (no real audio in the sandbox).

**Follow-up**: landing made marketing only (no stories, no listen buttons, player bar hidden there) on user feedback.

**Next**: user checks on Vercel after merging: press "Rebuild from all runs" on `/debug` first so the news pages have data; then play a story, queue a few, lock the phone.

## 2026-11-25: data for the public news pages

**Built** (`src/news/`): a run's saved output becomes the public pages' data. `buildNews` (pure) makes story rows (rank, neutral title, section, outlet count, left/center/right counts, `hasAnalysis` / `hasScript` / `hasAudio`, duration, a playable track), story pages (script paragraphs, analysis: summary, agreed facts, material disputes with sides and outlets, framing; outlets left to right with their own headlines) and the day (section counts, voiced count, the episode as one file and as tracks). `publishRun` writes `news/days/{date}.json`, `news/stories/{id}.json` and `news/index.json`; runs publish after rank, synthesize, script and assemble, and after "Use this version". `pickForLength` fills "Play this section" (5/10/15 min). JSON at `/data/news`, `/data/news/{date}` (with older/newer days for the date arrows and infinite scroll), `/data/story/{id}`. Admin: "Publish to news" on the run page, "News data" card with "Rebuild from all runs" on `/debug`.

**Checked here**: typecheck, 132 tests (`tests/news.test.ts`), `next build`. Not verified live.

**Next**: user presses "Rebuild from all runs" on `/debug` once (backfills existing runs); then build the pages from Stitch on top of this data.

## 2026-11-25: frontend spec (PRISM News), landing page, admin console frame

**Branch housekeeping**: the session branch started from an old commit because the repo's default branch had been `claude/gracious-feynman-icy2to` since day one (GitHub makes the first pushed branch the default). The user switched the default to `main`; every other branch is fully merged into `main`.

**Discussed**: the public site as a music web player (stories as tracks, Play / Add to queue, premade playlists per section and the daily episode, persistent bottom drawer with the queue, date selector with infinite scroll, story page = headline + script + analysis accordion, coverage split bar on every row). Unvoiced stories are listed without player buttons. Password stays for now; public access is a high-priority backlog item. Design will be made in Google Stitch from `docs/ui-sketch.md`, then built.

**Built**: `docs/ui-sketch.md` (Stitch brief); PRISM landing page at `/` (brand copy, no links except the admin console); admin pages moved into route group `app/(admin)` with a console frame (sidebar on desktop, tab row on phones) and a new `/debug` overview (start runs, latest run, latest episode, tiles); brand fonts (Playfair Display + Jost) and PRISM color tokens site-wide.

**Checked here**: typecheck, 123 tests, `next build`; screenshots of the landing (desktop, phone) and the console frame with sample data (pages that read Blob can't render in the sandbox).

**Next**: user builds the Stitch project; then import and build the news pages, player drawer and data (see todo).

## 2026-11-24: backlog-01, second batch (sections, every outlet, feeds page, time report)

**Discussed** (no code): wire copy (outlets running AP/Reuters text word for word inflates "agreed" facts and misattributes framing): two-step plan in the backlog. Fast yes/no classifiers (Jev): not useful here (the 300 s limit is per step, our calls aren't yes/no); dropped. Trafilatura check left for the user after merging; the function's open GET reply moved to a new Security section to discuss.

**Built**: every section label kept (`sections`); analysis picks one article per covering outlet, cap 25, balanced across sides when capped; `/debug/feeds` redesign with batch add (per source and all sources; `src/admin/feed-plan.ts` decides what's "active"); visible button style site-wide; "Copy time and cost for Claude" on the run page (`src/review/timing-report.ts`).

**Checked here**: typecheck, 123 tests, `next build`; the feeds page rendered with sample data and screenshotted (desktop light/dark, phone).

**Run page navigation**: shared `RunNav` on the run, ranking review, analysis and script pages: a prominent "← Run" button and tabs to jump straight between ranking review, analysis, script and the episode (greyed out until that step has run; version counts shown; the version picker stays on the analysis and script pages). Merged `backlog-01` to `main`.

**Next**: user's first 27-source run with the time and cost report.

## 2026-11-23: backlog-01 (merge check, 27 sources, versions, 5-story episodes, Trafilatura, Aria)

Branch `backlog-01` (first of a numbered series of backlog passes).

**Built**
- Merge check: new `merge` stage between cluster and rank (`src/stages/merge/llm-merge-v1.ts`): one Sonnet call (effort low) over story titles, newest headlines and publish-time spans; joins the same event or a direct follow-up into the larger story, title from the newest development. Merges listed on the run page; "Run merge check" re-runs merge + rank on older runs. Synthesis now gets publish times and states the latest development instead of a dispute.
- Sources: 15 added (3 per AllSides bucket: left, lean left, center, lean right, right), ratings checked on AllSides by web search; 27 total. Feed URLs come from feed directories (the sandbox can't fetch news sites), all marked untested. `/debug/feeds` shows a box to add repo sources missing from the live (Blob) list without losing edits. Discover now allows 300 s.
- Versions: every finished analysis/script/audio is kept (`src/pipeline/versions.ts`); run page "Versions" table (View / Use this version); `?v=n` on the analysis and script pages; script reviews belong to their version; episodes `{runId}-a{n}`, player lists all versions with labels.
- Episode shape: 5 stories, 540/540/390/390/390 words (~15 min); writer told a ceiling (×1.15); analysis top 8 stories, 10 articles each.
- Voice: Aria. Rundown: already top three in code; the user's 16-min episode was voiced from a script written before that fix.
- Trafilatura: `api/trafilatura.py` (Vercel Python function, `trafilatura==2.4.0`), called by the chain (`chain-v3`) after JSON-LD with the already-fetched page; failures fall through to Readability/Defuddle.

**Checked here**: typecheck, tests (merge, versions, Trafilatura link, budgets), `next build`; the Python function run locally against the page fixtures and over HTTP (auth rejected without the secret). Not checked: new feed URLs, the merge prompt on real data, and whether Vercel deploys the Python function next to Next.js; all in the user's steps.

**Next**: user adds and checks the new sources, runs a fresh run → analysis → script → audio, checks merges, Trafilatura in the extraction table, versions.

## 2026-11-23: todo.md repaired

The Phase 3 commit (`e809ce6`) had corrupted `docs/todo.md`: the Phase 3 section repeated ~12,000 times (168k lines) and the rest of the backlog was gone. Rebuilt it from the last good version (`81621cd`) plus one copy of the Phase 3 section (including the "Keep every version" item) and a "Next: Phase 4" placeholder. No other docs were affected.

## 2026-11-23: versions note

User asked whether remakes keep old versions. They don't (script and same-day episode are overwritten; see todo). Added "Keep every version" to the Phase 3 backlog; not built.

## 2026-11-23 (overnight): Phase 3 built

**Built** (plan: `docs/phase3-plan.md`): `TTSProvider` with `edge-tts` (via the `msedge-tts` package) and a silent `stub`; long segments voiced in sentence chunks with retries. `voice` stage fans out one step per segment, three at a time, cached at `audio/{audioKey}.mp3` so re-makes only voice changed text. `assemble` joins segments frame by frame (`src/audio/mp3.ts`) with 0.6 s silent-frame pauses, writes `episodes/{date}-{paramsHash}.mp3` and a manifest with chapter times. Run page: Phase 3 rows, "Make audio", "Play →". `/debug/voices` voice test (uses the same cache). Player `/player` (episode list) and `/player/[id]` (big controls, chapters, speed, resume, lock-screen controls). `/audio/...` streams private Blob with Range, ≤2 MB per response.

**Checked here**: typecheck, 105 tests, `next build`; the MP3 joiner against real ffmpeg-encoded 24 kHz mono files (decodes cleanly, exact length, silent pauses). Not checked: edge-tts itself (this sandbox can't reach Microsoft), Blob Range behaviour, and the phone's audio player with Basic auth: all three are in the user's morning steps.

**Live**: user confirmed it works on Vercel (edge-tts reachable, episode plays). Merged to `main`.

**Next**: pick a voice; confirm phone details (lock screen, resume); intro/outro wording.

## 2026-11-23: Phase 3 planned

Planned Phase 3 (audio and delivery) in `docs/phase3-plan.md`; nothing built. User chose Phase 3 only (no backlog items) and Google Chirp 3 HD as the fallback voice instead of Kokoro (Kokoro is too heavy for Vercel functions); Chirp waits in the backlog for the user's API key. Main risk is whether edge-tts works from Vercel; the voice test page checks it first.

## 2026-11-23: second script, polish, merge to main

**Second live script** (same run after re-analysis): 10/10 kept, 0 dropped, $0.41, 16 min (over the 13 min target). Top stories back; disagreements read as reporting; Jackson false contrast gone. Remaining: length, long rundown, quote rule fighting accuracy, unidentified people, coverage line on one-sided stories, and a stale fact (Foxx recount vs concession) from grouping. → `docs/reviews/2026-11-23-0146-script-2.md`

**Built**: rundown top three + "and more"; tone guide allows short attributed phrases when paraphrase would distort; one-sided coverage stated plainly, varied coverage lines; per-run who's who (`src/stages/script/whoswho.ts`, W… material). Length and the grouping/stale-fact fix went to the backlog with detail. Merged `phase2-v1` to `main`.

## 2026-11-23: first live script and fixes

**First live script** (run `2026-11-23T0146-25e3fa`, report in `docs/reviews/2026-11-23-0146-script.md`): 7 of 10 kept, $0.40, 10.3 min. Three of the top four (COP31, DNI Clayton, House majority) were dropped for single fixable claims: a misattributed clause, a title that was only in headlines, a softened quote the rewrite didn't fix. The Jackson segment staged trivial details as a left/right contrast.

**Agreed with the user**: presentation is always all sides; lean will only change story selection. Disagreements that matter are part of the reporting. No patching or cutting (it can remove one side), no backfill for now, web search on the wish list, grouping fixes logged under Phase 0.

**Built**
- Phase 1: synthesis marks disputes `material` / `minor`; "different details aren't a disagreement" rule; shown on the analysis page.
- Phase 2: headlines (H1…) in material; only material disputes; side labels only where the side matters; rewrites show the exact material for flagged claims (`related` ids from the checker); 3 full attempts; new checker kinds `false_contrast`, `missing_side`; tone guide "Where accounts differ".
- Visibility: red drop banner on the script page, notice on the run page, dropped stories first in the report with all drafts; precise "Not planned" reasons (outside the analyzed top N / headlines only / analysis failed).
- Also: total time on the run page; intro split into `welcome` / `rundown` / `outro`, each switchable.

## 2026-11-23: step-time fix

User saw steps reported as taking ~2 minutes that finished sooner. Two bugs:
- Fan-out stages (extract, analyze, synthesize, script) showed the *sum* of their parallel per-story step times (15 stories × 10s = "150s"). The Time column now shows elapsed time from the stage's start/finish timestamps, with summed step time underneath in small text.
- Re-running a stage appended its usage to the old entries, so time and cost grew with every re-run. Re-runs now replace that stage's usage. Old runs that were already re-run keep their inflated cost totals; their time column is correct because it now reads timestamps.

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
