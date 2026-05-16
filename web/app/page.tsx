"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type ExtractResult = {
  ok: true;
  url: string;
  title: string | null;
  byline: string | null;
  excerpt: string | null;
  length: number;
  text: string;
};

type ExtractError = { ok?: false; error: string; message?: string; status?: number };

type Quiz = {
  questions: {
    q: string;
    choices: string[];
    correct_index: number;
    explanation: string;
  }[];
};

type QuizGenResult = { ok: true; quiz_id: string; model: string; quiz: Quiz };
type QuizGenError = { ok?: false; error: string; message?: string };

type SubmitResult = {
  ok: true;
  attempt_id: string;
  score: number;
  total: number;
  correct_indices: number[];
  explanations: string[];
};
type SubmitError = { ok?: false; error: string; message?: string };

export default function Home() {
  const [url, setUrl] = useState("");
  const [extractLoading, setExtractLoading] = useState(false);
  const [extract, setExtract] = useState<ExtractResult | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);

  const [quizLoading, setQuizLoading] = useState(false);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [quizError, setQuizError] = useState<string | null>(null);

  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitLoading, setSubmitLoading] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const allAnswered = useMemo(
    () => quiz != null && quiz.questions.every((_, i) => answers[i] !== undefined),
    [quiz, answers],
  );

  function resetQuizState() {
    setQuiz(null);
    setQuizId(null);
    setQuizError(null);
    setAnswers({});
    setResult(null);
    setSubmitError(null);
  }

  async function onExtract(e: React.FormEvent) {
    e.preventDefault();
    setExtractLoading(true);
    setExtract(null);
    setExtractError(null);
    resetQuizState();
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const json = (await res.json()) as ExtractResult | ExtractError;
      if (!res.ok || !("ok" in json) || json.ok !== true) {
        const j = json as ExtractError;
        setExtractError(j.message ? `${j.error}: ${j.message}` : j.error);
      } else {
        setExtract(json);
      }
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : String(err));
    } finally {
      setExtractLoading(false);
    }
  }

  async function onGenerateQuiz() {
    if (!extract) return;
    setQuizLoading(true);
    resetQuizState();
    try {
      const res = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: extract.url,
          text: extract.text,
          title: extract.title,
        }),
      });
      const json = (await res.json()) as QuizGenResult | QuizGenError;
      if (!res.ok || !("ok" in json) || json.ok !== true) {
        const j = json as QuizGenError;
        setQuizError(j.message ? `${j.error}: ${j.message}` : j.error);
      } else {
        setQuiz(json.quiz);
        setQuizId(json.quiz_id);
      }
    } catch (err) {
      setQuizError(err instanceof Error ? err.message : String(err));
    } finally {
      setQuizLoading(false);
    }
  }

  async function onSubmit() {
    if (!quiz || !quizId || !allAnswered) return;
    setSubmitLoading(true);
    setSubmitError(null);
    setResult(null);
    try {
      const answersArr = quiz.questions.map((_, i) => answers[i]);
      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quiz_id: quizId, answers: answersArr }),
      });
      const json = (await res.json()) as SubmitResult | SubmitError;
      if (!res.ok || !("ok" in json) || json.ok !== true) {
        const j = json as SubmitError;
        setSubmitError(j.message ? `${j.error}: ${j.message}` : j.error);
      } else {
        setResult(json);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="flex items-baseline justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Feynd</h1>
        <Link
          href="/history"
          className="text-sm text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200"
        >
          History →
        </Link>
      </div>
      <p className="mt-2 text-sm text-neutral-500">
        Paste a URL, take the quiz, your score is saved.
      </p>

      <form onSubmit={onExtract} className="mt-8 flex gap-2">
        <input
          type="url"
          required
          placeholder="https://en.wikipedia.org/wiki/Richard_Feynman"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-400 dark:border-neutral-700"
        />
        <button
          type="submit"
          disabled={extractLoading || !url}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {extractLoading ? "Extracting…" : "Extract"}
        </button>
      </form>

      {extractError && (
        <div className="mt-6 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-300">
          <strong>Extract failed:</strong> {extractError}
        </div>
      )}

      {extract && (
        <article className="mt-8 space-y-3">
          <header>
            <h2 className="text-xl font-semibold">{extract.title ?? "(no title)"}</h2>
            {extract.byline && (
              <p className="text-sm text-neutral-500">{extract.byline}</p>
            )}
            <p className="text-xs text-neutral-400">
              {extract.length.toLocaleString()} characters
            </p>
          </header>
          {extract.excerpt && (
            <p className="text-sm italic text-neutral-600 dark:text-neutral-400">
              {extract.excerpt}
            </p>
          )}
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-neutral-800 dark:text-neutral-200">
            {extract.text.slice(0, 500)}
            {extract.text.length > 500 && "…"}
          </pre>

          <div className="pt-2">
            <button
              onClick={onGenerateQuiz}
              disabled={quizLoading}
              className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
            >
              {quizLoading ? "Generating quiz…" : quiz ? "Regenerate quiz" : "Generate Quiz"}
            </button>
          </div>
        </article>
      )}

      {quizError && (
        <div className="mt-6 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-300">
          <strong>Quiz failed:</strong> {quizError}
        </div>
      )}

      {quiz && (
        <section className="mt-10 space-y-6">
          <h3 className="text-lg font-semibold">
            {result ? "Results" : "Quiz"}
            {result && (
              <span className="ml-2 text-sm font-normal text-neutral-500">
                {result.score} / {result.total}
              </span>
            )}
          </h3>

          {quiz.questions.map((q, qi) => {
            const selected = answers[qi];
            const correct = result?.correct_indices[qi];
            return (
              <div
                key={qi}
                className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800"
              >
                <p className="font-medium">
                  {qi + 1}. {q.q}
                </p>
                <ul className="mt-3 space-y-1 text-sm">
                  {q.choices.map((c, ci) => {
                    const isSelected = selected === ci;
                    const isCorrect = result && ci === correct;
                    const isWrongChoice = result && isSelected && ci !== correct;
                    return (
                      <li key={ci}>
                        <button
                          type="button"
                          disabled={result != null}
                          onClick={() =>
                            setAnswers((a) => ({ ...a, [qi]: ci }))
                          }
                          className={[
                            "w-full rounded px-2 py-1 text-left transition",
                            result
                              ? isCorrect
                                ? "bg-green-50 text-green-900 dark:bg-green-950/40 dark:text-green-200"
                                : isWrongChoice
                                  ? "bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-200"
                                  : "text-neutral-500"
                              : isSelected
                                ? "bg-neutral-100 dark:bg-neutral-800"
                                : "hover:bg-neutral-50 dark:hover:bg-neutral-900",
                          ].join(" ")}
                        >
                          {String.fromCharCode(65 + ci)}. {c}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {result && (
                  <p className="mt-3 text-xs italic text-neutral-600 dark:text-neutral-400">
                    {result.explanations[qi]}
                  </p>
                )}
              </div>
            );
          })}

          {!result && (
            <div>
              <button
                type="button"
                onClick={onSubmit}
                disabled={!allAnswered || submitLoading}
                className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
              >
                {submitLoading ? "Submitting…" : "Submit answers"}
              </button>
              {!allAnswered && (
                <p className="mt-2 text-xs text-neutral-500">
                  Answer all {quiz.questions.length} questions to submit.
                </p>
              )}
              {submitError && (
                <p className="mt-2 text-xs text-red-600">{submitError}</p>
              )}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
