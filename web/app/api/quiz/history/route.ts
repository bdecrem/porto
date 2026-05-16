import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Returns recent quizzes with their best attempt score (if any).
// v1 is single shared anonymous user; later builds add per-user scoping.
export async function GET() {
  const sb = supabaseAdmin();

  const { data: quizzes, error: quizErr } = await sb
    .from("feynd_v1_quizzes")
    .select("id, source_url, source_title, created_at, questions")
    .order("created_at", { ascending: false })
    .limit(50);

  if (quizErr) {
    return NextResponse.json(
      { error: "fetch_failed", message: quizErr.message },
      { status: 500 },
    );
  }

  const quizIds = (quizzes ?? []).map((q) => q.id);
  const attemptsByQuiz = new Map<string, { score: number; total: number; created_at: string }>();

  if (quizIds.length > 0) {
    const { data: attempts, error: attErr } = await sb
      .from("feynd_v1_attempts")
      .select("quiz_id, score, created_at")
      .in("quiz_id", quizIds)
      .order("score", { ascending: false })
      .order("created_at", { ascending: false });

    if (attErr) {
      return NextResponse.json(
        { error: "fetch_failed", message: attErr.message },
        { status: 500 },
      );
    }

    for (const a of attempts ?? []) {
      // Order ensures the first row per quiz_id is the best attempt.
      if (!attemptsByQuiz.has(a.quiz_id)) {
        const total =
          (quizzes ?? []).find((q) => q.id === a.quiz_id)?.questions?.length ?? 0;
        attemptsByQuiz.set(a.quiz_id, {
          score: a.score,
          total,
          created_at: a.created_at,
        });
      }
    }
  }

  const items = (quizzes ?? []).map((q) => {
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

  return NextResponse.json({ ok: true, items });
}
