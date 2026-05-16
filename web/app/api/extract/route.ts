import { NextRequest, NextResponse } from "next/server";
import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_HTML_BYTES = 5_000_000;
const FETCH_TIMEOUT_MS = 20_000;

export async function POST(req: NextRequest) {
  let body: { url?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const url = body?.url;
  if (typeof url !== "string" || url.length === 0) {
    return NextResponse.json({ error: "missing_url" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "unsupported_protocol" }, { status: 400 });
  }

  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": "PortoBot/0.1 (+feynd)",
        accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "fetch_failed", status: res.status },
        { status: 502 },
      );
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_HTML_BYTES) {
      return NextResponse.json({ error: "too_large", bytes: buf.byteLength }, { status: 413 });
    }
    html = new TextDecoder("utf-8").decode(buf);
  } catch (err) {
    return NextResponse.json(
      { error: "fetch_error", message: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }

  try {
    const { document } = parseHTML(html);
    // Readability expects a Document; linkedom's is structurally compatible.
    const article = new Readability(document as unknown as Document).parse();
    if (!article) {
      return NextResponse.json({ error: "no_article_found" }, { status: 422 });
    }
    const text = article.textContent ?? "";
    return NextResponse.json({
      ok: true,
      url,
      title: article.title ?? null,
      byline: article.byline ?? null,
      excerpt: article.excerpt ?? null,
      length: article.length ?? text.length,
      text: text.slice(0, 5_000),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "parse_error", message: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
