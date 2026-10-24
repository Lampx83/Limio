import { NextResponse } from "next/server";
import { authorizeMeetingNotes } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";
import { dispatchClassMail } from "@/lib/queue/classMailJob";

export const runtime = "nodejs";

/** Tình trạng gửi tổng kết chung của một buổi: đã gửi, lỗi, bỏ qua. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await authorizeMeetingNotes(userId, params.id);
    const rows = await prisma.meetingSummaryDelivery.groupBy({ by: ["status"], where: { meetingId: params.id }, _count: true });
    const count = (s: string) => rows.find((r) => r.status === s)?._count ?? 0;
    return NextResponse.json({ sent: count("sent"), failed: count("failed"), skipped: count("skipped_optout") + count("skipped_no_email") });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

/** Gửi (hoặc gửi lại phần còn lỗi của) tổng kết chung — dùng khi lớp tắt tự gửi hoặc có email lỗi. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await authorizeMeetingNotes(userId, params.id);
    return NextResponse.json({ dispatch: await dispatchClassMail({ kind: "summary", meetingId: params.id }) });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
