# Decisions

The PRD's decision log (`docs/PRD.md` → "Decision log") is the baseline. This file records decisions made since, especially where they change the PRD. Newest first.

| Date | Topic | Decision | Why | PRD change? |
| :- | :- | :- | :- | :- |
| 2026-11-22 | The Hill | Headline-only: no page fetches (`analysis.skipPageFetch`); its headlines still count for coverage and framing | It returns HTTP 403 to our honest bot user agent; we don't disguise the bot | No |
| 2026-11-22 | Single-source facts | "Agreed" requires 2+ outlets; one-outlet facts go to `singleSourceFacts` and the summary attributes them | First run labelled one-outlet facts as agreed | Refines PRD "agreed facts" |
| 2026-11-22 | Headlines-only stories | Skip synthesis when no article in a story has facts | A synthesis wrote "no extracted facts…" into its summary | No |
| 2026-11-22 | One-sided disputes | Left as is for now | User's call: MVP first, tune later | No |
| 2026-11-22 | Rate limits | Anthropic SDK `maxRetries` 8 (backoff, honors retry-after); 2 concurrent fact calls per story step | Org concurrency limit hit with 15 story steps in parallel | No |
| 2026-11-22 | Extractor chain | feed text → JSON-LD articleBody → Readability → Defuddle → RSS summary (one page fetch) | More fallbacks when a page loads but one parser fails; none of them helps an outlet that blocks the request | Extends PRD chain |
| 2026-11-22 | Phase 1 rollout | Opt-in: "Start full run" stops after rank; "Run analysis (Phase 1)" runs extract → analyze → synthesize in place on a finished run | Keeps the user's daily Phase 0 runs unchanged while Phase 1 is unproven | Temporary |
| 2026-11-22 | Branches | `phase0-v1` = frozen Phase 0 snapshot; integration branch carries Phase 1 | User asked to earmark Phase 0 | No |
| 2026-11-22 | Phase 1 scope per run | Top 15 ranked stories, ≤8 articles each picked round-robin across outlets | Bounds cost/time; avoids one prolific outlet dominating facts | Tunable in config |
| 2026-11-22 | Fact quotes | Facts whose quote isn't found verbatim (after normalizing case, whitespace, quote marks, dashes; "…" gaps allowed) are dropped | The Phase 2 checker traces claims to quotes; an unverifiable quote is worthless | Enforces PRD intent |
| 2026-11-22 | Synthesis citations | The model cites fact ids (a2.f3); code maps them to article ids and verbatim quotes and drops anything that doesn't resolve | Prevents invented support and keeps output small | Implementation |
| 2026-11-22 | Effort | Haiku facts `low`, Sonnet synthesis `medium` | Cost; extraction is simple, synthesis needs more judgment | Tunable |
| 2026-11-22 | Prompt testing | Offline harness (`scripts/prompt-harness.ts`) with Claude sub-agents standing in for the API on a fictional fixture story; responses saved as regression fixtures | Sandbox has no API key or news access | No |
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
