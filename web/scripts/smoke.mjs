#!/usr/bin/env node
/**
 * Smoke test runner — hits a known set of endpoints against a configurable
 * base URL and prints a structured PASS/FAIL/SKIPPED report.
 *
 * Usage: BASE_URL=http://localhost:3000 node scripts/smoke.mjs
 *
 * Exit codes: 0 = all passed (skipped allowed), 1 = any failed.
 *
 * Each test:
 *   {
 *     name,
 *     method, path,
 *     body?           — object or (stash) => object,
 *     expectStatus,
 *     expectShape     — (json, stash) => null | string,
 *     skipIf?         — (json, status) => null | string,
 *     stash?          — (json) => Record<string, unknown>   merged into stash,
 *     skipUnlessStash? — string[]  test SKIPPED if any of these are missing,
 *   }
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

const FIXTURE_TEXT_LONG =
  "This is a deliberately substantial paragraph used to verify the quiz endpoint can produce questions from real-looking content. " +
  "The Roman Empire was founded in 27 BCE when Augustus became the first emperor. It lasted in the West until 476 CE and in the East until 1453. " +
  "At its peak under Trajan in 117 CE, the empire spanned three continents and contained roughly 70 million people. " +
  "Latin was the language of administration in the West, while Greek dominated the East. " +
  "The empire built extensive roads, aqueducts, and legal systems that influenced Western civilization for centuries afterward.";

const FIXTURE_URL = `${BASE_URL}/test-fixtures/article.html`;

// A real UUID format that will not exist in the DB.
const NONEXISTENT_QUIZ_ID = "00000000-0000-0000-0000-000000000000";

const tests = [
  {
    name: "GET /api/health",
    method: "GET",
    path: "/api/health",
    expectStatus: 200,
    expectShape: (j) =>
      j?.ok === true && j?.service === "porto-web"
        ? null
        : `bad shape: ${JSON.stringify(j)}`,
  },
  {
    name: "POST /api/extract (fixture)",
    method: "POST",
    path: "/api/extract",
    body: { url: FIXTURE_URL },
    expectStatus: 200,
    expectShape: (j) =>
      j?.ok === true &&
      typeof j?.title === "string" &&
      j.title.length > 0 &&
      typeof j?.text === "string" &&
      j.text.length > 100
        ? null
        : `bad shape: ${(JSON.stringify(j) ?? "").slice(0, 300)}`,
  },
  {
    name: "POST /api/extract (invalid url)",
    method: "POST",
    path: "/api/extract",
    body: { url: "not-a-url" },
    expectStatus: 400,
    expectShape: (j) =>
      j?.error === "invalid_url"
        ? null
        : `expected error=invalid_url, got: ${JSON.stringify(j)}`,
  },
  {
    name: "POST /api/extract (missing url)",
    method: "POST",
    path: "/api/extract",
    body: {},
    expectStatus: 400,
    expectShape: (j) =>
      j?.error === "missing_url"
        ? null
        : `expected error=missing_url, got: ${JSON.stringify(j)}`,
  },
  {
    name: "POST /api/quiz/generate (fixture text + url)",
    method: "POST",
    path: "/api/quiz/generate",
    body: {
      url: FIXTURE_URL,
      text: FIXTURE_TEXT_LONG,
      title: "The Roman Empire (test)",
    },
    expectStatus: 200,
    skipIf: (j, status) =>
      status === 503 && j?.error === "no_api_key"
        ? "AI_GATEWAY_API_KEY not set"
        : null,
    expectShape: (j) => {
      if (j?.ok !== true) return `expected ok:true, got: ${JSON.stringify(j)?.slice(0, 200)}`;
      if (typeof j?.quiz_id !== "string" || j.quiz_id.length < 8)
        return `quiz_id missing or short`;
      const qs = j?.quiz?.questions;
      if (!Array.isArray(qs) || qs.length !== 5) return `expected 5 questions, got ${qs?.length}`;
      for (const [i, q] of qs.entries()) {
        if (typeof q?.q !== "string") return `q[${i}].q not a string`;
        if (!Array.isArray(q?.choices) || q.choices.length !== 4)
          return `q[${i}].choices not 4 strings`;
        if (
          typeof q?.correct_index !== "number" ||
          q.correct_index < 0 ||
          q.correct_index > 3
        )
          return `q[${i}].correct_index out of range: ${q.correct_index}`;
        if (typeof q?.explanation !== "string") return `q[${i}].explanation not a string`;
      }
      return null;
    },
    stash: (j) => ({
      quiz_id: j.quiz_id,
      correct_indices: j.quiz.questions.map((q) => q.correct_index),
    }),
  },
  {
    name: "POST /api/quiz/generate (missing url)",
    method: "POST",
    path: "/api/quiz/generate",
    body: { text: FIXTURE_TEXT_LONG, title: "no url here" },
    expectStatus: 400,
    skipIf: (j, status) =>
      status === 503 && j?.error === "no_api_key"
        ? "AI_GATEWAY_API_KEY not set"
        : null,
    expectShape: (j) =>
      j?.error === "missing_url"
        ? null
        : `expected error=missing_url, got: ${JSON.stringify(j)}`,
  },
  {
    name: "POST /api/quiz/generate (text too short)",
    method: "POST",
    path: "/api/quiz/generate",
    body: { url: FIXTURE_URL, text: "too short" },
    expectStatus: 400,
    skipIf: (j, status) =>
      status === 503 && j?.error === "no_api_key"
        ? "AI_GATEWAY_API_KEY not set"
        : null,
    expectShape: (j) =>
      j?.error === "text_too_short"
        ? null
        : `expected error=text_too_short, got: ${JSON.stringify(j)}`,
  },
  {
    name: "POST /api/quiz/generate (missing text)",
    method: "POST",
    path: "/api/quiz/generate",
    body: { url: FIXTURE_URL },
    expectStatus: 400,
    skipIf: (j, status) =>
      status === 503 && j?.error === "no_api_key"
        ? "AI_GATEWAY_API_KEY not set"
        : null,
    expectShape: (j) =>
      j?.error === "missing_text"
        ? null
        : `expected error=missing_text, got: ${JSON.stringify(j)}`,
  },
  {
    name: "POST /api/quiz/submit (all correct)",
    method: "POST",
    path: "/api/quiz/submit",
    skipUnlessStash: ["quiz_id", "correct_indices"],
    body: (stash) => ({
      quiz_id: stash.quiz_id,
      answers: stash.correct_indices,
    }),
    expectStatus: 200,
    expectShape: (j) => {
      if (j?.ok !== true) return `expected ok:true, got: ${JSON.stringify(j)?.slice(0, 200)}`;
      if (j?.score !== 5) return `expected score=5, got ${j?.score}`;
      if (j?.total !== 5) return `expected total=5, got ${j?.total}`;
      if (!Array.isArray(j?.correct_indices) || j.correct_indices.length !== 5)
        return `bad correct_indices: ${JSON.stringify(j?.correct_indices)}`;
      return null;
    },
  },
  {
    name: "POST /api/quiz/submit (missing quiz_id)",
    method: "POST",
    path: "/api/quiz/submit",
    body: { answers: [0, 0, 0, 0, 0] },
    expectStatus: 400,
    expectShape: (j) =>
      j?.error === "missing_quiz_id"
        ? null
        : `expected error=missing_quiz_id, got: ${JSON.stringify(j)}`,
  },
  {
    name: "POST /api/quiz/submit (quiz_not_found)",
    method: "POST",
    path: "/api/quiz/submit",
    body: { quiz_id: NONEXISTENT_QUIZ_ID, answers: [0, 0, 0, 0, 0] },
    expectStatus: 404,
    expectShape: (j) =>
      j?.error === "quiz_not_found"
        ? null
        : `expected error=quiz_not_found, got: ${JSON.stringify(j)}`,
  },
  {
    name: "POST /api/quiz/submit (invalid answers)",
    method: "POST",
    path: "/api/quiz/submit",
    body: { quiz_id: NONEXISTENT_QUIZ_ID, answers: [0, 1, 2, 3, 9] },
    expectStatus: 400,
    expectShape: (j) =>
      j?.error === "invalid_answers"
        ? null
        : `expected error=invalid_answers, got: ${JSON.stringify(j)}`,
  },
  {
    name: "GET /api/quiz/history",
    method: "GET",
    path: "/api/quiz/history",
    expectStatus: 200,
    expectShape: (j) => {
      if (j?.ok !== true) return `expected ok:true, got: ${JSON.stringify(j)?.slice(0, 200)}`;
      if (!Array.isArray(j?.items)) return `items not an array: ${typeof j?.items}`;
      // Items can legitimately be empty on a fresh deploy, but shape must be right.
      for (const [i, it] of j.items.slice(0, 3).entries()) {
        if (typeof it?.quiz_id !== "string") return `items[${i}].quiz_id not string`;
        if (typeof it?.source_url !== "string") return `items[${i}].source_url not string`;
        if (typeof it?.total !== "number") return `items[${i}].total not number`;
      }
      return null;
    },
  },
];

let passed = 0;
let failed = 0;
let skipped = 0;
const results = [];
const stash = {};

for (const t of tests) {
  const url = BASE_URL + t.path;
  const start = Date.now();

  if (t.skipUnlessStash) {
    const missing = t.skipUnlessStash.filter((k) => !(k in stash));
    if (missing.length > 0) {
      skipped++;
      results.push({
        name: t.name,
        status: "SKIPPED",
        reason: `stash missing: ${missing.join(", ")} (upstream test likely SKIPPED)`,
      });
      continue;
    }
  }

  let body;
  if (typeof t.body === "function") body = t.body(stash);
  else body = t.body;

  try {
    const res = await fetch(url, {
      method: t.method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const ms = Date.now() - start;
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }

    const skipReason = t.skipIf ? t.skipIf(json, res.status) : null;
    if (skipReason) {
      skipped++;
      results.push({ name: t.name, status: "SKIPPED", reason: skipReason, ms });
      continue;
    }

    const statusOk = res.status === t.expectStatus;
    const shapeErr = statusOk && json !== null ? t.expectShape(json, stash) : null;

    if (statusOk && !shapeErr) {
      passed++;
      results.push({ name: t.name, status: "PASS", http: res.status, ms, body: json });
      if (t.stash && json) {
        Object.assign(stash, t.stash(json));
      }
    } else {
      failed++;
      results.push({
        name: t.name,
        status: "FAIL",
        http: res.status,
        expected: t.expectStatus,
        ms,
        body: json ?? text,
        error: !statusOk
          ? `expected ${t.expectStatus}, got ${res.status}`
          : shapeErr,
      });
    }
  } catch (err) {
    failed++;
    results.push({
      name: t.name,
      status: "FAIL",
      error: `request failed: ${err.message}`,
    });
  }
}

const overall = failed === 0 ? "PASS" : "FAIL";
console.log(
  `\nsmoke: ${overall}  (${passed} passed, ${failed} failed, ${skipped} skipped)\n`,
);
for (const r of results) {
  if (r.status === "PASS") {
    console.log(`  PASS     ${r.name}  -> ${r.http} (${r.ms}ms)`);
    const body = JSON.stringify(r.body);
    console.log(`           body: ${body.length > 200 ? body.slice(0, 200) + "…" : body}`);
  } else if (r.status === "SKIPPED") {
    console.log(`  SKIPPED  ${r.name}  (${r.reason})`);
  } else {
    console.log(`  FAIL     ${r.name}`);
    console.log(`           error: ${r.error}`);
    if (r.body !== undefined) {
      const body = typeof r.body === "string" ? r.body : JSON.stringify(r.body);
      console.log(`           body:  ${body.length > 300 ? body.slice(0, 300) + "…" : body}`);
    }
  }
}
console.log("");

process.exit(failed === 0 ? 0 : 1);
