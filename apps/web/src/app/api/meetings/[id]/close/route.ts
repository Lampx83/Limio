import { NextResponse } from "next/server";
import { closeMeeting } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";
import { dispatchClassMail } from "@/lib/queue/classMailJob";

export const runtime = "nodejs";

/** Kết thúc buổi (C4.1): đóng buổi, chụp tổng kết, và nếu lớp bật tự gửi thì xếp hàng gửi cả lớp (C4.4). */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const r = await closeMeeting(userId, params.id);
    // Gửi lại khi đóng lần hai không gây gửi trùng (idempotent), nhưng cũng không cần xếp hàng lại.
    const dispatch = r.autoSend && !r.alreadyClosed ? await dispatchClassMail({ kind: "summary", meetingId: params.id }) : null;
    return NextResponse.json({ meetingId: r.meetingId, alreadyClosed: r.alreadyClosed, autoSend: r.autoSend, dispatch, summary: r.summary });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
