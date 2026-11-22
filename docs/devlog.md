# Dev log

One entry per work session, newest first: what changed, what we learned, what's next.

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
