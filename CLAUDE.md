@AGENTS.md

# Spread the News (brand: PRISM News)

Personal daily news podcast: 12 RSS sources balanced left to right → stories grouped by Claude → ranked by cross-spectrum coverage → summarized and voiced. Spec: `docs/PRD.md`.

## Where things are
- `docs/todo.md`: the backlog. Read it at the start of a session, update it at the end.
- `docs/devlog.md`: dated session log. Add an entry for every work session.
- `docs/decisions.md`: decisions and every deviation from the PRD, with reasons.
- `docs/architecture.md`: code layout, pipeline, storage, how to add a stage.
- `docs/tone-guide.md`: how the podcast sounds; script writer and checker follow it. Add rules there.
- `docs/ui-sketch.md`: the public site and admin console design brief (input for Google Stitch; build from the Stitch project).
- `docs/stack.md`: stack choices, env vars, costs.
- `docs/reviews/`: the user's pasted run reviews, one file per run.

## Working rules
- Remote-only project. The dev sandbox can't reach news sites or the Vercel deployment: unit-test against fixtures in `tests/`, and verify live behavior through the user on the Vercel deployment (`/debug/runs`, `/debug/feeds`).
- Before pushing: `npm run typecheck`, `npm test`, `npx next build`.
- Tunable values live in `config/pipeline.json`. The live source list is edited on `/debug/feeds` (stored in Blob); `config/sources.json` is the default.
- Claude models: Sonnet 5.5 for clustering/synthesis/script, Haiku 5.5 for per-article facts (per PRD). Use the `claude-api` skill before changing LLM code.
- The user isn't a developer: give browser steps, not terminal commands, when they need to act.
