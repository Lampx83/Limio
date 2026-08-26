import { NextResponse } from "next/server";
import { shareExamLink } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * "Phát link" — publish đề, dựng ca + phòng mặc định, sinh mã dự thi, trả link.
 * Gọi lại trên bài đã phát thì trả đúng mã cũ.
 *
 * Body: { timingMode?: "manual" | "scheduled" }  (mặc định manual)
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await readJson(req)) as { timingMode?: unknown } | null;
  const timingMode =
    body?.timingMode === "scheduled" ? ("scheduled" as const) : ("manual" as const);

  try {
    const r = await shareExamLink(userId, params.id, { timingMode });
    return NextResponse.json(r);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
