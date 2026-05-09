#!/usr/bin/env node
/**
 * Smoke test runner — hits a known set of endpoints against the dev server
 * and prints a structured PASS/FAIL/SKIPPED report the verifier can parse.
 *
 * Usage: BASE_URL=http://localhost:3000 node scripts/smoke.mjs
 *
 * Exit codes: 0 = all passed (skipped allowed), 1 = any failed.
 *
 * Each test:
 *   { name, method, path, body?, expectStatus, expectShape, skipIf? }
 *   expectShape: (json) => string|null   (null = ok, string = error reason)
 *   skipIf:      (json, status) => string|null   (string reason → SKIPPED)
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

const FIXTURE_TEXT_LONG =
  "This is a deliberately substantial paragraph used to verify the quiz endpoint can produce questions from real-looking content. " +
  "The Roman Empire was founded in 27 BCE when Augustus became the first emperor. It lasted in the West until 476 CE and in the East until 1453. " +
  "At its peak under Trajan in 117 CE, the empire spanned three continents and contained roughly 70 million people. " +
  "Latin was the language of administration in the West, while Greek dominated the East. " +
  "The empire built extensive roads, aqueducts, and legal systems that influenced Western civilization for centuries afterward.";

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
    body: { url: `${BASE_URL}/test-fixtures/article.html` },
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
    name: "POST /api/quiz/generate (fixture text)",
    method: "POST",
    path: "/api/quiz/generate",
    body: { text: FIXTURE_TEXT_LONG, title: "The Roman Empire (test)" },
    expectStatus: 200,
    skipIf: (j, status) =>
      status === 503 && j?.error === "no_api_key"
        ? "AI_GATEWAY_API_KEY not set"
        : null,
    expectShape: (j) => {
      if (j?.ok !== true) return `expected ok:true, got: ${JSON.stringify(j)?.slice(0, 200)}`;
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
  },
  {
    name: "POST /api/quiz/generate (text too short)",
    method: "POST",
    path: "/api/quiz/generate",
    body: { text: "too short" },
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
    body: {},
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
];

let passed = 0;
let failed = 0;
let skipped = 0;
const results = [];

for (const t of tests) {
  const url = BASE_URL + t.path;
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: t.method,
      headers: t.body ? { "content-type": "application/json" } : undefined,
      body: t.body ? JSON.stringify(t.body) : undefined,
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
    const shapeErr = statusOk && json !== null ? t.expectShape(json) : null;

    if (statusOk && !shapeErr) {
      passed++;
      results.push({ name: t.name, status: "PASS", http: res.status, ms, body: json });
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
