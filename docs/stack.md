# Spread the News: stack

Personal daily news podcast for one user: cross-spectrum RSS → LLM story grouping and ranking → summaries → TTS episode in a private web player.

- **Repo:** rishipkothari/spread-the-news
- **Planned:** 2026-11-21 · **Last updated:** 2026-11-23
- **Status:** in progress (Phase 3 built, being verified)
- **Budget:** ~$2/day soft target for Claude usage; Vercel Hobby
- **Learning goals:** durable workflows, LLM pipelines with structured output, cost-aware ranking design
- **New for me (★):** Vercel Workflows, Vercel Blob

## Big-picture decisions

| Decision | Choice | Why |
| :- | :- | :- |
| Application shape | Batch pipeline + small private web UI | One run per day, results viewed in a browser |
| Runtime model | Serverless functions + durable workflow steps | Long multi-step runs without a server |
| Language | TypeScript everywhere | One language; Readability and SDKs available |
| All-in-one vs. best-of-breed | All-in-one on Vercel | Hosting, workflows and storage in one place |
| Users and accounts | One user, password gate; models allow more later | Personal use (PRD) |
| Data shape | JSON documents per run in Blob; Postgres in Phase 4 | Runs are write-once snapshots |
| Budget, scale, lock-in | Free tiers + Claude usage; accept Vercel lock-in | Small scale; speed of building |

## Components

| Component | Choice | New? | Runbook |
| :- | :- | :- | :- |
| Hosting | Vercel (Hobby) | | components/hosting.md |
| Frontend framework | Next.js 16 (App Router) | | components/framework.md |
| Backend / API | Next.js route handlers + server actions | | components/backend.md |
| Database | Not needed yet (Blob JSON); Neon + Drizzle in Phase 4 | | components/database.md |
| Schema and migrations | Not needed yet | | components/migrations.md |
| Auth | Basic auth password gate (pages) + Bearer secret (API) | | components/auth.md |
| Secrets and env vars | Vercel environment variables | | components/secrets.md |
| Environments | Vercel Preview + Production; no local dev | | components/environments.md |
| Third-party APIs | Anthropic Claude API; news RSS feeds; Microsoft Edge Read Aloud voices via `msedge-tts` (unofficial, free); Google Chirp 3 HD planned as fallback | | components/apis.md |
| Payments | Not needed (personal) | | components/payments.md |
| File storage | Vercel Blob (private) | ★ | components/storage.md |
| Email | Not needed | | components/email.md |
| Scheduled and background jobs | Vercel Workflows; cron later | ★ | components/jobs.md |
| Testing | Vitest on fixtures | | components/testing.md |
| CI/CD | Vercel Git deploys; no CI yet | | components/ci-cd.md |
| Monitoring and logging | Debug pages + per-run usage.json | | components/monitoring.md |
| Domains and DNS | Not needed (vercel.app) | | components/domains.md |
| Costs | usage.json per run; Anthropic console spend limit | | components/costs.md |

## Environment variables

| Name | Purpose | Secret? | Source | Local | Preview | Production |
| :- | :- | :- | :- | :- | :- | :- |
| `ANTHROPIC_API_KEY` | Claude API | Yes | Anthropic console | – | ✓ | ✓ |
| `BLOB_READ_WRITE_TOKEN` | Blob store access | Yes | Added by connecting the Blob store | – | ✓ | ✓ |
| `RUN_SECRET` | Bearer token for `/api/runs` | Yes | Made up | – | ✓ | ✓ |
| `PLAYER_PASSWORD` | Password for pages | Yes | Made up | – | ✓ | ✓ |
| `BLOB_ACCESS` | `private` (default) or `public` | No | Optional | – | – | – |

## Costs

| Service | Plan | Monthly cost | Limits / alerts | Notes |
| :- | :- | :- | :- | :- |
| Vercel | Hobby | $0 | Function duration ≈300s per step | |
| Vercel Blob | Hobby allowance | $0 | | |
| Edge TTS | Free (unofficial endpoint) | $0 | Can change or block without notice | Fallback: Google Chirp 3 HD (backlog) |
| Anthropic API | Pay as you go | ~$3/month so far (≈$0.10 per run, cluster only) | Console spend limit | Will grow with Phase 1–2 |

## Open questions

- See `docs/PRD.md` → Open questions and `docs/todo.md`.

## Log

- 2026-11-21: PRD written; Vercel project, Blob store and API key created.
- 2026-11-22: Phase 0 built and running on Vercel.
- 2026-11-23: Phases 1–2 merged; Phase 3 (edge-tts voice, MP3 assembly, private player) built.
