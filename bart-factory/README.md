# The Bart Factory

A workflow for building software with AI agents where **the agent — not the human — is responsible for verifying that every change actually works.**

## The pain it fixes

When AI agents write code, the human ends up being the test harness. Code "compiles" but doesn't run. An endpoint is "implemented" but returns wrong data. A UI "renders" but the click handler is broken. The agent says "done," the human runs the app, finds the bug, reports it back, the agent fixes it, repeat.

The verification loop *is happening* — the human is just doing the work. The Bart Factory closes that loop. The agent verifies its own work at every layer, with structured evidence, before claiming a task is done.

## The four principles

1. **Definition of Done is written down per layer.** No layer is "done" until its explicit success criteria are met with cited evidence. Agents read this before claiming completion.

2. **Every layer has a verifier.** A verifier is a script + a subagent that owns running it. Output is machine-parseable PASS / FAIL / SKIPPED with reasons.

3. **Failure paths are tested as first-class citizens.** If the contract says "bad input → 400," the smoke test sends bad input and asserts on 400. Don't only test happy paths.

4. **SKIPPED is honest, silent-skip is not.** When a check can't run (missing key, layer not built yet), it reports SKIPPED with a clear reason. Never silently pass.

## The primitives

| Primitive | Role |
|---|---|
| `docs/definition-of-done.md` | The contract every change must satisfy |
| `CLAUDE.md` (root) | The non-negotiable rules pinned to the project |
| `.claude/agents/<layer>-verifier.md` | Per-layer verifier subagents |
| `.claude/commands/verify.md` | Aggregator — fans out to all verifiers in parallel |
| `<stack>/scripts/smoke.<ext>` | The actual verifier script for a given stack |
| Hermetic test fixtures | Smoke tests should not depend on the live internet |

## When to use it

- Multi-layer projects (iOS + backend + 3rd party + DB)
- Non-engineer collaborating with AI to build software
- Anywhere silent regressions are unacceptable

When NOT to use it: throwaway scripts you'll delete in an hour.

## How to use this on a NEW project

In a fresh project directory, type `/bart-factory-init` (the user-level slash command at `~/.claude/commands/bart-factory-init.md`). Claude will ask the shaping questions and scaffold the workflow primitives adapted to your stack.

Alternatively, copy `bart-factory/INIT_PROMPT.md` and paste it into the first Claude Code session in your new directory.

## How to use this on porto / Feynd

See `bart-factory/STATUS.md` for the current state. Feynd is the substrate the Bart Factory was developed on; treat porto as the reference implementation, not a finished product.

## Maintenance

`bart-factory/INIT_PROMPT.md` is the canonical prompt. The user-level slash command at `~/.claude/commands/bart-factory-init.md` mirrors it. **If you update the prompt here, also re-sync the slash command** (or vice versa). Both files note this at the top.
