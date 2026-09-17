import { NextResponse } from "next/server";
import { sendAccessExpiryReminders } from "@feedbackme/core-lms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily: gửi email nhắc học viên có accessExpiresAt trong 7 ngày tới và chưa
 * từng được nhắc. Best-effort — 1 email lỗi không chặn các dòng khác.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const res = await sendAccessExpiryReminders();
  return NextResponse.json({ ok: true, ...res });
}
