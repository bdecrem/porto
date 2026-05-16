-- Porto / Feynd — Build 2 schema
--
-- Lives in a Supabase project shared with other apps (kochi, amber, etc.),
-- hence the `feynd_v1_` prefix. v1 = paste-arbitrary-URL flow.
--
-- Single shared anonymous user for v1; no auth column. Auth/per-user scoping
-- comes in a later build, at which point we add a `user_id` column.

create table if not exists feynd_v1_quizzes (
  id            uuid primary key default gen_random_uuid(),
  source_url    text not null,
  source_title  text,
  source_text   text not null,
  -- [{ q, choices: [str, str, str, str], correct_index: 0-3, explanation }]
  questions     jsonb not null,
  model         text,
  created_at    timestamptz not null default now()
);

create table if not exists feynd_v1_attempts (
  id            uuid primary key default gen_random_uuid(),
  quiz_id       uuid not null references feynd_v1_quizzes(id) on delete cascade,
  -- [chosen_index, ...] one entry per quiz question
  answers       jsonb not null,
  score         int not null,
  created_at    timestamptz not null default now()
);

create index if not exists feynd_v1_quizzes_created_at_idx
  on feynd_v1_quizzes (created_at desc);

create index if not exists feynd_v1_attempts_quiz_id_idx
  on feynd_v1_attempts (quiz_id);

create index if not exists feynd_v1_attempts_created_at_idx
  on feynd_v1_attempts (created_at desc);

-- RLS on, no policies = service role only. Anon key cannot read or write.
-- This is intentional: the Next.js backend uses the service key, the browser
-- never talks to Supabase directly.
alter table feynd_v1_quizzes enable row level security;
alter table feynd_v1_attempts enable row level security;
