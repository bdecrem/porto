# Architecture

## Data flow (Feynd v1)

```
[iPhone app]
    │  POST /api/quiz/generate { url }
    ▼
[Next.js on Vercel]
    │  fetch(url) → @mozilla/readability → clean text
    │  Claude (via AI Gateway) → quiz JSON
    │  insert into Supabase → quiz_id
    ▼
{ quiz_id, questions: [...] }
    │
    ▼
[iPhone app]  user takes quiz
    │  POST /api/quiz/submit { quiz_id, answers }
    ▼
[Next.js]
    │  grade answers
    │  insert score into Supabase
    ▼
{ score, correct_answers }
    │
    ▼
[iPhone app]  shows score, history
```

## Stack rationale

| Layer | Choice | Why |
|---|---|---|
| Backend framework | Next.js (App Router) | Vercel-native, Bart is familiar with it |
| Compute | Vercel Fluid Compute (default) | No edge runtime gotchas, supports full Node, 300s timeouts |
| LLM access | Vercel AI Gateway with `"anthropic/claude-..."` strings | Model swappable without code changes; observability built in |
| DB + Auth | Supabase | Bart is familiar; Postgres + auth + storage in one |
| iOS | SwiftUI | Modern Apple default; less boilerplate than UIKit |
| Article extraction | `@mozilla/readability` + `jsdom` | Battle-tested, MIT, runs in Node |
| iOS distribution | TestFlight | Real distribution path, exercises the whole chain |

## The verification architecture

Each layer has a **verifier subagent** that owns running the layer's checks and returning a structured PASS/FAIL report.

```
.claude/agents/
├── backend-verifier.md       Runs typecheck, lint, build, endpoint smoke tests
├── ios-build-verifier.md     (later) Runs xcodebuild + simulator smoke
├── integration-tester.md     (later) End-to-end against deployed preview
└── deployment-verifier.md    (later) Confirms Vercel + TestFlight state
```

The `/verify` slash command fans out to all relevant verifiers in parallel and aggregates results.

The orchestrating Claude Code agent must call the appropriate verifier (or `/verify`) before declaring any task complete — this is enforced by `CLAUDE.md` and `docs/definition-of-done.md`.

## Database schema (initial)

```sql
-- supabase/migrations/0001_init.sql (added during milestone 1)
create table quizzes (
  id uuid primary key default gen_random_uuid(),
  source_url text not null,
  source_title text,
  source_text text not null,
  questions jsonb not null,           -- [{ q, choices[], correct_index }]
  created_at timestamptz default now()
);

create table quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references quizzes(id),
  answers jsonb not null,             -- [chosen_index, ...]
  score int not null,
  created_at timestamptz default now()
);
```

(Auth/users layer added once base loop works — for v1 dev we'll use a single anonymous user.)
