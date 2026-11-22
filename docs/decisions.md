# Decisions

The PRD's decision log (`docs/PRD.md` → "Decision log") is the baseline. This file records decisions made since, especially where they change the PRD. Newest first.

| Date | Topic | Decision | Why | PRD change? |
| :- | :- | :- | :- | :- |
| 2026-11-22 | Ranking weights | C 0.50, B 0.25, P 0.25 (was 0.55 / 0.30 / 0.15) | P now carries real signal (homepage + feed type) instead of being mostly zero | Yes |
| 2026-11-22 | Prominence (P) | Per outlet, strongest signal: homepage top-10 1.0, top-40 0.7, listed 0.5; top feed 0.8, latest 0.25, section 0.15. P = mean over covering outlets | Only BBC/HuffPost had true top feeds, so P was 0 for most stories; homepages give every outlet a comparable "was it a headline" signal | Yes (P definition) |
| 2026-11-22 | Feed types | `top` / `latest` / `section` (was `top` / `section`) | Most outlets' main feed is an everything firehose, not an editorial front page | Yes (data model) |
| 2026-11-22 | Homepage check | Fetch each outlet's homepage every run (robots.txt honored); record article positions as `homepageRank` | Uniform prominence signal across outlets; no special feeds needed | New |
| 2026-11-22 | Source registry | `blob-json`: live list editable on `/debug/feeds`, saved to Blob, falls back to `config/sources.json` | Lets the user tune feeds from the browser without code changes; runs snapshot their sources so they stay reproducible | Adds an implementation |
| 2026-11-22 | Minimum outlets | 2 (was 3) | First review: only 7 stories ranked, and 2-outlet stories the user wanted were excluded. One-sided 2-outlet stories still score low via B and S | Yes |
| 2026-11-22 | Clusterer output | Return only stories covered by ≥2 outlets; article types only for those articles | Keeps output short (≈3k tokens); singletons can't rank anyway | Narrows the contract |
| 2026-11-22 | Sources' leans | Chosen by Claude from known AllSides ratings; Fox and NewsNation verified, others `verified: false` | User asked to start without looking them up; re-check is on the backlog | No |
| 2026-11-22 | Models | `claude-sonnet-5-5` (cluster, synthesis, script, checker), `claude-haiku-5-5` (facts); server-side refusal fallback on; effort `medium` for clustering | PRD says Sonnet/Haiku; current generation | No |
| 2026-11-22 | Framework | Next.js 16 + Workflow SDK 5 (`workflow` package), React 19, zod 4 | Current versions at scaffold time | No |
| 2026-11-22 | Page auth | HTTP Basic auth (any username, `PLAYER_PASSWORD`) in `proxy.ts` for all non-API pages; API uses `Bearer RUN_SECRET` | Simplest password gate that works in a phone browser | No |
| 2026-11-22 | Blob access | Private store, deterministic paths (no random suffix) | Stages need to find each other's output; privacy comes from the private store | Replaces "random suffixes" |
| 2026-11-22 | Triggering | Browser buttons on `/debug/runs` (server actions) in addition to the API | User is non-technical; no terminal needed | Adds a UI |
