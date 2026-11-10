import { NextResponse } from "next/server";
import { getPracticeBlockSummaryForEditor } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** Tóm tắt khối Bài luyện (số đoạn, số câu) cho hàng khối trong trang soạn bài. Chỉ người sửa được khoá chứa bài. */
export async function GET(_req: Request, { params }: { params: { contentId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await getPracticeBlockSummaryForEditor(userId, params.contentId));
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
