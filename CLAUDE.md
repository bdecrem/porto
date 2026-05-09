# Porto — instructions for Claude Code

## What this project is

Porto is the **reference implementation of the Bart Factory** — a verification-first development methodology where the agent (not the human) owns proving every change works. See `bart-factory/README.md` for the methodology and `bart-factory/STATUS.md` for the current state of this implementation.

The test app inside Porto is **Feynd**: paste a URL → extract text → generate a quiz → user takes it on iPhone → score saved. See `README.md` for full scope.

## Non-negotiable rules

1. **Read `docs/definition-of-done.md` before claiming any task complete.** Every layer has explicit success criteria. If you can't produce evidence the criteria are met, the task isn't done.

2. **Run the relevant verifier before declaring success.** Use the verifier subagents in `.claude/agents/`:
   - Backend changes → `backend-verifier`
   - iOS changes → `ios-build-verifier` (added later)
   - Cross-layer changes → run `/verify`

3. **Never tell the user "I made the change, please test it."** That's the broken pattern Porto exists to fix. If you can't test it yourself, say so explicitly and explain what's blocking automated verification — then propose a way to make it verifiable.

4. **Structured output over prose.** When a verifier runs, it should produce machine-parseable PASS/FAIL with cited evidence (file:line for errors, response bodies for endpoint failures). Don't summarize away the detail.

5. **Bart is not an engineer.** Frame explanations at the product/workflow level. Drop into code only when needed or asked.

## Stack

- Backend: Next.js (App Router) on Vercel, Fluid Compute
- DB + Auth: Supabase
- LLM: Claude via Vercel AI Gateway (`provider/model` strings)
- iOS: Swift / SwiftUI, TestFlight distribution
- Article extraction: `@mozilla/readability` + `jsdom`

## Workflow primitives

- `docs/definition-of-done.md` — the contract
- `.claude/agents/*-verifier.md` — per-layer verifiers
- `.claude/commands/verify.md` — full-stack verify
- (Later) `.claude/settings.json` hooks to auto-trigger verifiers on file edits
