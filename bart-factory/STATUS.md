# Porto / Feynd — current status

Last updated: **2026-05-15**

## What porto is

Porto is the **reference implementation** of the Bart Factory. The "Feynd" app inside it (paste URL → extract clean text → generate AI quiz) is the substrate on which the methodology is being developed and stress-tested. Treat porto as a reference, not a finished product.

## Live URL

**Production:** https://porto-hazel-omega.vercel.app — open on any phone or browser, paste an article URL, take the AI-generated quiz.

## What's built

### Workflow infrastructure (the actual Bart Factory)

- `bart-factory/README.md` — the methodology (principles, primitives, when to use)
- `bart-factory/INIT_PROMPT.md` — the launchpad for new projects
- `bart-factory/STATUS.md` — this file
- `docs/definition-of-done.md` — contract per layer
- `docs/architecture.md` — stack + data flow
- `CLAUDE.md` (root) — non-negotiable rules pinned to the project
- `.claude/agents/backend-verifier.md` — Layer 1 verifier (typecheck / lint / build / smoke on localhost)
- `.claude/agents/deployment-verifier.md` — Layer 4 verifier (smoke against a deployed URL)
- `.claude/commands/verify.md` — full-stack verify aggregator
- `~/.claude/commands/bart-factory-init.md` — user-level slash command (works in any project)

### Backend — `web/` (Next.js 16, deployed to Vercel)

- Vercel project: `bart-r-decrems-projects/porto`, root dir `web`, linked to `github.com/bdecrem/porto` (push-to-deploy)
- Production alias: `porto-hazel-omega.vercel.app`
- `app/api/health/route.ts` — health ping
- `app/api/extract/route.ts` — POST URL → linkedom + Mozilla Readability → clean article text
- `app/api/quiz/generate/route.ts` — POST text → Claude Sonnet 4.6 via AI Gateway → 5 zod-validated quiz questions
- `scripts/smoke.mjs` — 7-case smoke runner (URL configurable via `BASE_URL`)
- `npm run smoke` (localhost), `npm run smoke:prod` (production alias)
- `public/test-fixtures/article.html` — hermetic fixture for extraction smoke

### UI — `web/app/page.tsx`

- Paste URL → Extract button → result panel → Generate Quiz button → 5 questions with show-answer toggle

### Verification status (last run, 2026-05-15)

- **Local backend-verifier:** PASS (typecheck / lint / build / 7-case smoke against dev server)
- **Deployment-verifier against `porto-hazel-omega.vercel.app`:** PASS (7/7 smoke cases against live production URL, including live LLM quiz generation)

### What the deploy loop caught (Bart Factory dogfood)

The smoke-against-deployed-URL pass uncovered two prod-only failures that local smoke had passed cleanly:

1. **jsdom ESM/CJS bundling failure on Vercel runtime.** `jsdom@29 → html-encoding-sniffer@6 → @exodus/bytes@1.15` — the sniffer does `require()` on an ESM-only module; Node on Vercel rejected it, the local build (different Node loader behavior) didn't. Fix: replaced jsdom with linkedom in `app/api/extract/route.ts`.
2. **Missing `AI_GATEWAY_API_KEY` in production env.** OIDC was enabled on the project but `VERCEL_OIDC_TOKEN` was not injected into the runtime. Fix: set `AI_GATEWAY_API_KEY` in Vercel production env vars.

Both are exactly the class of regression the methodology exists to catch before users see them.

## What's NOT built yet

| Item | Status |
|---|---|
| Build 2: Supabase persistence (quizzes + scores + history view) | not started |
| Build 3: iOS app | `ios/` is empty |
| Preview deploys via git push branches | infrastructure ready (git connected, OIDC on), but smoke-against-preview blocked by Vercel Deployment Protection — needs bypass token or protection disabled |
| iOS verifier subagent | not started |
| Hooks (`.claude/settings.json`) to auto-fire verifiers on edits | not started |
| UI verifier (Playwright or similar) — UI is currently eyeballed | not started |
| YouTube ingestion (deferred from extraction) | not started |
| Meta-quiz (across multiple articles) | not started |

## How to resume

1. Read `bart-factory/README.md` for the methodology refresher.
2. Read this file.
3. **Local dev:** `cd web && npm install && vercel env pull .env.local --yes && npm run dev`.
4. **Verify local:** `npm run smoke` from `/web`, or invoke the `backend-verifier` subagent.
5. **Verify production:** `npm run smoke:prod` from `/web`, or invoke the `deployment-verifier` subagent.
6. **Deploy:** any push to `main` on `github.com/bdecrem/porto` triggers a Vercel production deploy (root dir = `web`). Or run `vercel --prod` from the repo root for an ad-hoc deploy.
7. Pick a Build above and execute. Recommended order: Build 2 (Supabase) → Build 3 (iOS).
