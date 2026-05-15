import { NextResponse } from "next/server";
import { computeAllAnalytics } from "@feedbackme/core-lms";

export const runtime = "nodejs";

/**
 * A5.4 — Nightly item-analytics rebuild. Cron sidecar curls this at 02:00.
 * Idempotent — UPSERT per row. Target runtime ≤ 30s for ≤ 500 exams.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const r = await computeAllAnalytics();
  return NextResponse.json({ ok: true, ...r });
}
