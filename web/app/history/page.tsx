import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type HistoryItem = {
  quiz_id: string;
  source_url: string;
  source_title: string | null;
  created_at: string;
  total: number;
  best_score: number | null;
  attempted_at: string | null;
};

async function getHistory(): Promise<HistoryItem[]> {
  const sb = supabaseAdmin();

  const { data: quizzes } = await sb
    .from("feynd_v1_quizzes")
    .select("id, source_url, source_title, created_at, questions")
    .order("created_at", { ascending: false })
    .limit(50);

  const quizIds = (quizzes ?? []).map((q) => q.id);
  const attemptsByQuiz = new Map<string, { score: number; created_at: string }>();

  if (quizIds.length > 0) {
    const { data: attempts } = await sb
      .from("feynd_v1_attempts")
      .select("quiz_id, score, created_at")
      .in("quiz_id", quizIds)
      .order("score", { ascending: false })
      .order("created_at", { ascending: false });

    for (const a of attempts ?? []) {
      if (!attemptsByQuiz.has(a.quiz_id)) {
        attemptsByQuiz.set(a.quiz_id, { score: a.score, created_at: a.created_at });
      }
    }
  }

  return (quizzes ?? []).map((q) => {
    const best = attemptsByQuiz.get(q.id);
    return {
      quiz_id: q.id,
      source_url: q.source_url,
      source_title: q.source_title,
      created_at: q.created_at,
      total: q.questions?.length ?? 0,
      best_score: best?.score ?? null,
      attempted_at: best?.created_at ?? null,
    };
  });
}

function fmtDate(s: string): string {
  try {
    return new Date(s).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return s;
  }
}

export default async function HistoryPage() {
  const items = await getHistory();

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="flex items-baseline justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">History</h1>
        <Link
          href="/"
          className="text-sm text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200"
        >
          ← New quiz
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="mt-10 text-sm text-neutral-500">
          No quizzes yet. <Link href="/" className="underline">Start one</Link>.
        </p>
      ) : (
        <ul className="mt-10 space-y-3">
          {items.map((item) => {
            const scored = item.best_score != null;
            return (
              <li
                key={item.quiz_id}
                className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {item.source_title ?? item.source_url}
                    </p>
                    <p className="truncate text-xs text-neutral-500">
                      {item.source_url}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {scored ? (
                      <p className="text-sm font-semibold">
                        {item.best_score}/{item.total}
                      </p>
                    ) : (
                      <p className="text-xs text-neutral-500">not taken</p>
                    )}
                    <p className="text-xs text-neutral-400">
                      {fmtDate(item.attempted_at ?? item.created_at)}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
