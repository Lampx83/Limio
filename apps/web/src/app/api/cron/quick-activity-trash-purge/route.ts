import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { purgeExpiredQuickActivities } from "@feedbackme/core-lms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hằng ngày: xoá vĩnh viễn phiên Hoạt động nhanh đã nằm trong thùng rác quá 30 ngày.
 * Idempotent — chỉ chạm phiên có deletedAt đủ cũ nên chạy lại an toàn.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const purged = await purgeExpiredQuickActivities(prisma);
  return NextResponse.json({ ok: true, purged });
}
