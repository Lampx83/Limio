import { NextResponse } from "next/server";
import { getPracticeAnswerKeyForTeaching } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Chiếu lớp (docs/tieu-chi/hsk-che-do-chieu-lop.md, A6): đáp án và lời giải của MỘT câu Bài luyện, chỉ cho người dạy của khoá
 * (chủ, đồng giảng viên, giảng viên không sửa, trợ giảng). Chỉ trả chữ đã rút gọn, không trả cấu hình thô; không ghi gì, không phát sự kiện.
 */
export async function GET(_req: Request, { params }: { params: { questionId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await getPracticeAnswerKeyForTeaching(userId, params.questionId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
