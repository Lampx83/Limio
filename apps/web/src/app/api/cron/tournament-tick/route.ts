import { NextResponse } from "next/server";
import { tournamentTick } from "@feedbackme/core-gamification";

export const runtime = "nodejs";

/**
 * Cron handler — Vercel calls this every 5 min (vercel.json). Auth via the
 * shared CRON_SECRET header (Vercel sets this automatically when configured
 * in dashboard).
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const r = await tournamentTick();
  return NextResponse.json({ ok: true, ...r });
}
