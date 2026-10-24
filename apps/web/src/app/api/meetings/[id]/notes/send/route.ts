import { NextResponse } from "next/server";
import { authorizeMeetingNotes } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";
import { dispatchClassMail } from "@/lib/queue/classMailJob";

export const runtime = "nodejs";

/** "Gửi tất cả đã duyệt" (C4.10): chỉ bản approved được gửi; bản nháp không bao giờ. Gửi qua hàng đợi có retry (C4.17). */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await authorizeMeetingNotes(userId, params.id);
    return NextResponse.json({ dispatch: await dispatchClassMail({ kind: "notes", meetingId: params.id }) });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
