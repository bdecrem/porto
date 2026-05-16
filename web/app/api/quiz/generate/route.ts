import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "anthropic/claude-sonnet-4-6";
const MIN_TEXT_CHARS = 200;
const MAX_TEXT_CHARS = 12_000;

const QuizSchema = z.object({
  questions: z
    .array(
      z.object({
        q: z.string().min(5),
        choices: z.array(z.string().min(1)).length(4),
        correct_index: z.number().int().min(0).max(3),
        explanation: z.string().min(1),
      }),
    )
    .length(5),
});

export async function POST(req: NextRequest) {
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    return NextResponse.json(
      {
        error: "no_api_key",
        message:
          "AI_GATEWAY_API_KEY is not set. Add it to web/.env.local or run `vercel env pull` from a linked project.",
      },
      { status: 503 },
    );
  }

  let body: { text?: unknown; title?: unknown; url?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const text = body?.text;
  const title = typeof body?.title === "string" ? body.title : null;
  const url = typeof body?.url === "string" ? body.url : null;

  if (typeof text !== "string") {
    return NextResponse.json({ error: "missing_text" }, { status: 400 });
  }
  if (text.length < MIN_TEXT_CHARS) {
    return NextResponse.json(
      { error: "text_too_short", min: MIN_TEXT_CHARS, got: text.length },
      { status: 400 },
    );
  }
  if (!url) {
    return NextResponse.json({ error: "missing_url" }, { status: 400 });
  }

  const trimmed = text.slice(0, MAX_TEXT_CHARS);

  let quiz: z.infer<typeof QuizSchema>;
  try {
    const { object } = await generateObject({
      model: MODEL,
      schema: QuizSchema,
      prompt: [
        "You are a teacher creating a comprehension quiz from an article.",
        "Generate exactly 5 multiple-choice questions.",
        "",
        "Rules:",
        "- Each question tests understanding of the article (not trivia or recall of trivial facts)",
        "- Exactly 4 plausible answer choices per question",
        "- correct_index is 0-based",
        "- Each question must include a one-sentence explanation of the correct answer",
        "- Avoid 'all of the above' or 'none of the above'",
        "",
        title ? `Article title: ${title}` : "",
        "",
        "ARTICLE:",
        trimmed,
      ]
        .filter(Boolean)
        .join("\n"),
    });
    quiz = object;
  } catch (err) {
    return NextResponse.json(
      {
        error: "generation_failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }

  const { data, error } = await supabaseAdmin()
    .from("feynd_v1_quizzes")
    .insert({
      source_url: url,
      source_title: title,
      source_text: trimmed,
      questions: quiz.questions,
      model: MODEL,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      {
        error: "persist_failed",
        message: error?.message ?? "insert returned no row",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    quiz_id: data.id,
    model: MODEL,
    quiz,
  });
}
