import { NextResponse } from "next/server";
import { detectHeartbeatLost } from "@feedbackme/core-lms";
import { recordHeartbeatLost } from "@/lib/exam-live-bus";

export const runtime = "nodejs";

/**
 * A5.3.6 — Heartbeat-lost detector. Docker cron sidecar curls this every 2
 * minutes. Detects in-progress attempts whose `lastHeartbeatAt` is older than
 * 90s, emits at most one event per attempt per 5-minute dedup window, and
 * pushes a bus signal so the instructor dashboard turns the live dot red
 * without waiting for its own clock tick.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const r = await detectHeartbeatLost();
  for (const d of r.detected) {
    recordHeartbeatLost(d.attemptId, d.lostForMs);
  }
  return NextResponse.json({ ok: true, ...r });
}
