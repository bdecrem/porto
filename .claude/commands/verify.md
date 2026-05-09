---
description: Run full-stack verification across all layers (backend, iOS, integration). Fans out to verifier subagents in parallel and aggregates results.
---

You are running `/verify` for the Porto/Feynd project.

## What to do

1. Determine which layers are present and need verification:
   - **Backend** (`/web`) — verify if `web/package.json` exists.
   - **iOS** (`/ios`) — verify if `ios/*.xcodeproj` or `ios/Package.swift` exists. (Skip with "not yet scaffolded" if neither exists.)
   - **Integration** — only if explicitly requested with `/verify integration`. Otherwise skip.

2. For each present layer, **launch the corresponding verifier subagent in parallel** (single message, multiple Agent tool calls):
   - Backend → `backend-verifier`
   - iOS → `ios-build-verifier` (when it exists)

3. Wait for all results.

4. Aggregate into a single report:

```
/verify: <PASS|FAIL>

  backend: <PASS|FAIL|SKIPPED>
    [verbatim sub-report from backend-verifier]

  ios:     <PASS|FAIL|SKIPPED>
    [verbatim sub-report from ios-build-verifier, or "not yet scaffolded"]
```

5. If anything failed: do **not** suggest fixes in this command. The role of `/verify` is to *report*, not to *fix*. The user (or the calling agent) decides whether to dispatch fixes.

## Rules

- Run verifiers in parallel, never sequentially, when there is more than one.
- Never claim PASS for a layer that wasn't actually verified in this run.
- Keep the aggregated output compact — verbatim sub-reports, no extra prose.
