import { NextResponse } from "next/server";
import { expireDueEnrollments } from "@feedbackme/core-lms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily reaper: chuyển Enrollment có accessExpiresAt đã qua từ active sang
 * expired + emit enrollment.access.expired. Idempotent — chỉ chạm vào
 * enrollment đang status=active nên chạy lại an toàn.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const res = await expireDueEnrollments();
  return NextResponse.json({ ok: true, ...res });
}
