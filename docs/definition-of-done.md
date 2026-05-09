# Definition of Done

This is the contract every change must satisfy before it ships. Read it before claiming any task complete.

The principle: **a change isn't done until the agent has produced evidence that it works.** "It compiled" is not evidence. "I tested it manually in my head" is not evidence. Evidence is a passing verifier with cited output.

---

## Layer 1 — Backend (Next.js / Vercel)

A backend change is done when:

- [ ] **Type-check passes.** `npm run typecheck` exits 0.
- [ ] **Lint passes.** `npm run lint` exits 0.
- [ ] **Build passes.** `npm run build` exits 0.
- [ ] **Smoke test passes.** With `npm run dev` running, every changed/added endpoint returns the expected status + response shape against a known input. The verifier records the actual request and response.
- [ ] **No regressions.** All endpoints that existed before still pass their smoke tests.

**Evidence required:** structured output from `backend-verifier` subagent showing each step's exit code and (for endpoint tests) request/response pairs.

---

## Layer 2 — iOS (Swift / Xcode) — added in milestone 2

An iOS change is done when:

- [ ] **`xcodebuild` succeeds** for the iPhone simulator destination.
- [ ] **Unit tests pass** (`xcodebuild test`).
- [ ] **App launches** in the simulator without crashing (verified via `xcrun simctl` + a screenshot check).
- [ ] **The user-facing flow that was changed still works** end-to-end against the local backend (verified via UI test or scripted simctl interaction).

**Evidence required:** structured output from `ios-build-verifier` subagent.

---

## Layer 3 — Integration (iOS ↔ Backend) — added in milestone 3

An integration change is done when:

- [ ] **The full chain works against the deployed Vercel preview** for at least one realistic input (e.g., paste a real article URL → quiz appears → submit answers → score saves).
- [ ] **Each step in the chain is logged** with structured output the agent can read on failure.

**Evidence required:** integration test transcript showing every hop succeeded.

---

## Layer 4 — Deployment — added in milestone 4

A deploy is done when:

- [ ] **Vercel preview deploy succeeded** (verified via `vercel inspect` or API).
- [ ] **TestFlight build uploaded and processed** (verified via App Store Connect API).
- [ ] **Post-deploy smoke test passes** against the preview URL.

**Evidence required:** deployment URLs + smoke test transcript.

---

## SKIPPED status

A check may report `SKIPPED` when a precondition isn't met (e.g., LLM smoke tests when `AI_GATEWAY_API_KEY` isn't configured locally). SKIPPED is acceptable for local dev but **not acceptable in CI / before deploy** — the deployment-verifier (added later) treats SKIPPED as FAIL.

## What "evidence" means in practice

When you run a verifier, it should output something like:

```
backend-verifier: PASS
  typecheck: PASS (0 errors)
  lint: PASS (0 errors, 0 warnings)
  build: PASS (built in 4.2s)
  smoke: PASS
    GET  /api/health         200  { ok: true }
    POST /api/quiz/generate  200  { id: "...", questions: [5 items] }
```

Or on failure:

```
backend-verifier: FAIL
  typecheck: FAIL
    web/app/api/quiz/generate/route.ts:42 — Type 'string' is not assignable to type 'number'
  build: SKIPPED (typecheck failed)
  smoke: SKIPPED
```

Failure must point at the file, the line, and the actual error — never just "the build broke."

---

## Anti-patterns (do not do these)

- ❌ "I made the change. Please verify it works on your end."
- ❌ "The code looks correct."
- ❌ "It should work now."
- ❌ Skipping verification because "the change was small."
- ❌ Marking a task complete when verification was skipped or failed.

If a verifier doesn't exist for the layer you changed, the task is *to build the verifier first*, then make the change.
