import { NextResponse } from "next/server";
import { autoSubmitExpiredAttempts } from "@feedbackme/core-lms";

export const runtime = "nodejs";

/**
 * Cron handler — Docker cron sidecar curls this every minute. Auth via shared
 * CRON_SECRET. Idempotent: if no attempts have passed deadline since the last
 * call, it returns processed=0.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const r = await autoSubmitExpiredAttempts();
  return NextResponse.json({ ok: true, ...r });
}
