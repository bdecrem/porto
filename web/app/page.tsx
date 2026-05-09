"use client";

import { useState } from "react";

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

type QuizResult = { ok: true; model: string; quiz: Quiz };
type QuizError = { ok?: false; error: string; message?: string };

export default function Home() {
  const [url, setUrl] = useState("");
  const [extractLoading, setExtractLoading] = useState(false);
  const [extract, setExtract] = useState<ExtractResult | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);

  const [quizLoading, setQuizLoading] = useState(false);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  async function onExtract(e: React.FormEvent) {
    e.preventDefault();
    setExtractLoading(true);
    setExtract(null);
    setExtractError(null);
    setQuiz(null);
    setQuizError(null);
    setRevealed({});
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
    setQuiz(null);
    setQuizError(null);
    setRevealed({});
    try {
      const res = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: extract.text, title: extract.title }),
      });
      const json = (await res.json()) as QuizResult | QuizError;
      if (!res.ok || !("ok" in json) || json.ok !== true) {
        const j = json as QuizError;
        setQuizError(j.message ? `${j.error}: ${j.message}` : j.error);
      } else {
        setQuiz(json.quiz);
      }
    } catch (err) {
      setQuizError(err instanceof Error ? err.message : String(err));
    } finally {
      setQuizLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Feynd</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Build 1 — paste a URL, extract the article, then generate a quiz.
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
              {quizLoading ? "Generating quiz…" : "Generate Quiz"}
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
          <h3 className="text-lg font-semibold">Quiz</h3>
          {quiz.questions.map((q, qi) => (
            <div
              key={qi}
              className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800"
            >
              <p className="font-medium">
                {qi + 1}. {q.q}
              </p>
              <ul className="mt-3 space-y-1 text-sm">
                {q.choices.map((c, ci) => {
                  const isCorrect = ci === q.correct_index;
                  const isRevealed = revealed[qi];
                  return (
                    <li
                      key={ci}
                      className={
                        isRevealed
                          ? isCorrect
                            ? "rounded px-2 py-1 bg-green-50 text-green-900 dark:bg-green-950/40 dark:text-green-200"
                            : "rounded px-2 py-1 text-neutral-500"
                          : "rounded px-2 py-1"
                      }
                    >
                      {String.fromCharCode(65 + ci)}. {c}
                    </li>
                  );
                })}
              </ul>
              <button
                onClick={() => setRevealed((r) => ({ ...r, [qi]: !r[qi] }))}
                className="mt-3 text-xs text-neutral-500 underline"
              >
                {revealed[qi] ? "Hide answer" : "Show answer"}
              </button>
              {revealed[qi] && (
                <p className="mt-2 text-xs italic text-neutral-600 dark:text-neutral-400">
                  {q.explanation}
                </p>
              )}
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
