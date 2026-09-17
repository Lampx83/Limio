import { NextResponse } from "next/server";
import { closeOralExamSession, openOralExamSession } from "@feedbackme/core-lms";
import { requireFeature } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** Mở buổi vấn đáp: publish đề (nếu còn nháp) + mở ca cho cả khoá học. */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireFeature("ai_oral.access");
  if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const durationOverrideMin =
    typeof body?.durationOverrideMin === "number" ? body.durationOverrideMin : undefined;
  try {
    const r = await openOralExamSession(userId, params.id, { durationOverrideMin });
    return NextResponse.json(r);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

/** Đóng ca vấn đáp đang mở — chặn thí sinh mới, không đụng bài đang làm dở. */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireFeature("ai_oral.access");
  if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    await closeOralExamSession(userId, params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
