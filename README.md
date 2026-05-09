# Porto / Feynd

**Porto** is a workflow experiment. **Feynd** is the test app it's built around.

## What Feynd does (v1)

1. Paste a URL (article)
2. Backend fetches + extracts the readable text
3. An LLM generates a 5-question quiz
4. You take the quiz on iPhone
5. Score is saved to Supabase, history visible in the app

## Why Porto exists

The point isn't the app. The point is to build a **verification-first workflow** for AI-assisted development — one where the agent can detect breakage at every layer (build, deploy, integration, end-to-end) without the human having to be the test harness.

Every architectural decision is judged against: *does this close the verification loop so the agent can self-correct?*

## Layout

```
porto/
├── docs/                  The workflow itself
│   ├── definition-of-done.md   What "working" means at every layer
│   └── architecture.md         Stack and data flow
├── web/                   Next.js backend (Vercel)
├── ios/                   SwiftUI app (TestFlight)
└── .claude/               Subagents, slash commands, hooks
    ├── agents/            Specialized verifiers per layer
    └── commands/          /verify, /ship
```

## Quickstart

```bash
# 1. Install backend deps
cd web && npm install

# 2. Run the backend
npm run dev

# 3. From repo root, run the verification loop
# (in Claude Code)
/verify
```

## The workflow primitives

- **Definition of Done** (`docs/definition-of-done.md`) — the agent reads this before claiming any task complete.
- **Verifier subagents** (`.claude/agents/*-verifier.md`) — each owns one layer and returns structured PASS/FAIL.
- **`/verify` slash command** — fans out to all verifiers in parallel.
- **Hooks** (later) — fire verifiers automatically on relevant edits.
