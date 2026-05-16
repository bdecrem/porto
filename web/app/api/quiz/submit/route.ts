import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Question = {
  q: string;
  choices: string[];
  correct_index: number;
  explanation: string;
};

export async function POST(req: NextRequest) {
  let body: { quiz_id?: unknown; answers?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const quizId = body?.quiz_id;
  const answers = body?.answers;

  if (typeof quizId !== "string" || quizId.length === 0) {
    return NextResponse.json({ error: "missing_quiz_id" }, { status: 400 });
  }
  if (!Array.isArray(answers)) {
    return NextResponse.json({ error: "missing_answers" }, { status: 400 });
  }
  if (!answers.every((a) => Number.isInteger(a) && a >= 0 && a <= 3)) {
    return NextResponse.json({ error: "invalid_answers" }, { status: 400 });
  }

  const sb = supabaseAdmin();

  const { data: quizRow, error: fetchErr } = await sb
    .from("feynd_v1_quizzes")
    .select("id, questions")
    .eq("id", quizId)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json(
      { error: "fetch_failed", message: fetchErr.message },
      { status: 500 },
    );
  }
  if (!quizRow) {
    return NextResponse.json({ error: "quiz_not_found" }, { status: 404 });
  }

  const questions = quizRow.questions as Question[];
  if (answers.length !== questions.length) {
    return NextResponse.json(
      {
        error: "answers_length_mismatch",
        expected: questions.length,
        got: answers.length,
      },
      { status: 400 },
    );
  }

  const correctIndices = questions.map((q) => q.correct_index);
  const score = answers.reduce(
    (acc: number, a: number, i: number) => acc + (a === correctIndices[i] ? 1 : 0),
    0,
  );

  const { data: attempt, error: insertErr } = await sb
    .from("feynd_v1_attempts")
    .insert({
      quiz_id: quizId,
      answers,
      score,
    })
    .select("id, created_at")
    .single();

  if (insertErr || !attempt) {
    return NextResponse.json(
      {
        error: "persist_failed",
        message: insertErr?.message ?? "insert returned no row",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    attempt_id: attempt.id,
    score,
    total: questions.length,
    correct_indices: correctIndices,
    explanations: questions.map((q) => q.explanation),
  });
}
