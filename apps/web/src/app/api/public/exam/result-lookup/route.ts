import { NextResponse } from "next/server";
import { lookupCandidateResult } from "@feedbackme/core-lms";
import { mapKnownError, readJson } from "@/lib/apiHelpers";
import { allow, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * A5.8 Q6 — Public result lookup. Candidate re-enters code (and email for
 * open mode) every time; no cookie-based public URL. Rate-limited 10/min/IP
 * to slow down brute-force enumeration of emails against a known openCode.
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  const burst = await allow("result:burst", ip, 10, 60_000);
  if (!burst.ok) {
    return NextResponse.json(
      { error: "rate_limited", retryAfter: burst.retryAfterSec },
      { status: 429, headers: { "retry-after": String(burst.retryAfterSec) } },
    );
  }
  const body = (await readJson(req)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "validation_failed" }, { status: 400 });

  try {
    const r = await lookupCandidateResult(body.code, body.email);
    return NextResponse.json(r);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
