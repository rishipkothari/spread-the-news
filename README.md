# Spread the News

A personal daily news podcast: 12 RSS sources balanced left to right, grouped into stories, ranked by how universally they're covered, then summarized and voiced. See the PRD for the full design.

**Status: Phase 0 (story discovery).** Stages: `sources → fetch → cluster → rank`, run as a Vercel Workflow, with every stage's output saved to Blob.

## Layout

```
config/pipeline.json     implementation id per stage, models, ranking weights, vanilla RunParams
config/sources.json      the 12 sources (feeds, AllSides lean, prominence)
src/stages/*             one folder per stage; each implements an interface in src/stages/types.ts
src/stages/registry.ts   maps config ids → implementations
src/pipeline/*           stage runner, run status, replay, story history
src/workflows/*          the Vercel Workflow ("use workflow") and its steps ("use step")
app/api/runs/*           authenticated API
app/debug/runs/*         debug pages (password-protected)
tests/                   unit tests on fixtures (the dev sandbox can't reach news sites)
```

## Environment

`ANTHROPIC_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `RUN_SECRET`, `PLAYER_PASSWORD`, and optionally `BLOB_ACCESS` (`private` by default; set `public` only if the Blob store was created public).

## API

All `/api` routes need `Authorization: Bearer $RUN_SECRET`. Set `BASE` to the deployment URL.

Start a full vanilla run:

```bash
curl -X POST "$BASE/api/runs" -H "Authorization: Bearer $RUN_SECRET"
```

Feed health check only (no LLM cost):

```bash
curl -X POST "$BASE/api/runs" -H "Authorization: Bearer $RUN_SECRET" --json '{"stages":{"through":"fetch"}}'
```

Re-cluster an earlier run's articles (reuses its fetch output):

```bash
curl -X POST "$BASE/api/runs" -H "Authorization: Bearer $RUN_SECRET" --json '{"replayFrom":"<runId>","stages":{"from":"cluster"}}'
```

Re-rank a run in place after changing weights (no LLM cost):

```bash
curl -X POST "$BASE/api/runs/<runId>/stages/rank" -H "Authorization: Bearer $RUN_SECRET"
```

Status, per-stage state and usage:

```bash
curl "$BASE/api/runs/<runId>" -H "Authorization: Bearer $RUN_SECRET"
```

Debug pages (browser, any username + `PLAYER_PASSWORD`): `/debug/runs`, `/debug/runs/<runId>`, `/debug/runs/<runId>/review`, and `/debug/feeds`.

## Sources and feeds

`config/sources.json` is the default source list. Edits made on `/debug/feeds` (add, remove or retype feeds; enable or disable sources) are saved to Blob at `config/sources.json` and win from the next run. "Download sources.json" on that page exports the live list in the repo format so it can be committed back.

Feed types: `top` (editorial front page), `latest` (everything), `section` (one topic; its section is a category hint). Each run also fetches every outlet's homepage and records where our articles appear on it (`homepageRank`). The ranker's prominence term P is the mean, over covering outlets, of each outlet's strongest signal: homepage lead, featured or listed, then top, latest or section feed. Weights live in `config/pipeline.json` under `ranking.prominence`.

## Development

```bash
npm test
```

```bash
npm run typecheck
```

Regenerate the synthetic ranking fixture after changing it:

```bash
npx tsx scripts/make-fixture-bundle.ts
```

## Project docs

`docs/` holds the PRD, backlog (`todo.md`), dev log, decisions, architecture, stack record and saved run reviews. `CLAUDE.md` is the short entry point for Claude sessions.
