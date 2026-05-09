# Porto / Feynd — current status

Last updated: **2026-05-09**

## What porto is

Porto is the **reference implementation** of the Bart Factory. The "Feynd" app inside it (paste URL → extract clean text → generate AI quiz) is the substrate on which the methodology is being developed and stress-tested. Treat porto as a reference, not a finished product.

## What's built

### Workflow infrastructure (the actual Bart Factory)

- `bart-factory/README.md` — the methodology (principles, primitives, when to use)
- `bart-factory/INIT_PROMPT.md` — the launchpad for new projects
- `bart-factory/STATUS.md` — this file
- `docs/definition-of-done.md` — contract per layer
- `docs/architecture.md` — stack + data flow
- `CLAUDE.md` (root) — non-negotiable rules pinned to the project
- `.claude/agents/backend-verifier.md` — first verifier subagent
- `.claude/commands/verify.md` — full-stack verify aggregator
- `~/.claude/commands/bart-factory-init.md` — user-level slash command (works in any project)

### Backend — `web/` (Next.js 16, Vercel-linked, OIDC-authed for AI Gateway)

- `app/api/health/route.ts` — health ping
- `app/api/extract/route.ts` — POST URL → Mozilla Readability → clean article text
- `app/api/quiz/generate/route.ts` — POST text → Claude Sonnet 4.6 via AI Gateway → 5 zod-validated quiz questions
- `scripts/smoke.mjs` — 7-case smoke runner with PASS/FAIL/SKIPPED output
- `public/test-fixtures/article.html` — hermetic fixture for extraction smoke

### UI — `web/app/page.tsx`

- Paste URL → Extract button → result panel → Generate Quiz button → 5 questions with show-answer toggle

### Verification status (last run)

All 7 smoke cases PASS against live dev server with OIDC token:
- `health`, `extract` (3 cases incl. failure paths), `quiz/generate` (3 cases incl. live LLM call)

## What's NOT built yet

| Item | Status |
|---|---|
| Build 2: Supabase persistence (quizzes + scores + history view) | not started |
| Build 3: iOS app | `ios/` is empty |
| Build 4: Vercel preview deploy + smoke-against-preview | not started |
| iOS verifier subagent | not started |
| Hooks (`.claude/settings.json`) to auto-fire verifiers on edits | not started |
| UI verifier (Playwright or similar) — UI is currently eyeballed | not started |
| YouTube ingestion (deferred from extraction) | not started |
| Meta-quiz (across multiple articles) | not started |

## How to resume

1. Read `bart-factory/README.md` for the methodology refresher.
2. Read this file.
3. **Restart dev server:** `cd web && npm run dev`. The OIDC token in `.env.local` has a ~12-hour TTL — if quiz smoke tests start returning 401, re-run `vercel env pull .env.local --yes` from `/web`.
4. Run `npm run smoke` from `/web` to confirm everything still works.
5. Pick a Build above and execute. Recommended order: Build 2 (Supabase) → Build 4 (deploy preview) → Build 3 (iOS) — gets the most value out of the verification chain before adding the heavyweight iOS layer.
