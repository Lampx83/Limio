import { NextResponse } from "next/server";
import {
  assessPromotionReadiness,
  getItemTrialHistory,
  promoteBankQuestion,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** Chuỗi thử nghiệm của một câu hỏi + đánh giá đã đủ điều kiện kết nạp chưa. */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const history = await getItemTrialHistory(userId, params.id);
    return NextResponse.json({
      history,
      readiness: assessPromotionReadiness(history),
    });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

/**
 * Kết nạp câu hỏi vào kho.
 *
 * Body: { reason?: string } — bắt buộc khi bằng chứng chưa đủ. Cảnh báo chứ
 * không chặn cứng: giáo viên có căn cứ mà thống kê không thấy.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await readJson(req)) as { reason?: unknown } | null;
  const reason = typeof body?.reason === "string" ? body.reason : undefined;

  try {
    const r = await promoteBankQuestion(userId, params.id, { reason });
    return NextResponse.json(r);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
