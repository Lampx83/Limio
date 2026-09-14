import { NextResponse } from "next/server";
import { shareExamLink } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * "Mở buổi thi" — publish đề, dựng ca + phòng mặc định, sinh mã dự thi, trả link.
 * Gọi lại trên buổi đã mở thì trả đúng mã cũ.
 *
 * Body: { timingMode?, durationMin?, opensAt?, closesAt?, revealAnswers?, purpose? }
 *
 * Thời lượng và giờ thuộc BUỔI THI, không thuộc gói đề.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await readJson(req)) as {
    timingMode?: unknown;
    durationMin?: unknown;
    opensAt?: unknown;
    closesAt?: unknown;
    revealAnswers?: unknown;
    purpose?: unknown;
  } | null;
  const timingMode =
    body?.timingMode === "scheduled" ? ("scheduled" as const) : ("manual" as const);
  const durationMin =
    typeof body?.durationMin === "number" && body.durationMin > 0
      ? body.durationMin
      : undefined;
  const opensAt =
    typeof body?.opensAt === "string" ? new Date(body.opensAt) : undefined;
  const closesAt =
    typeof body?.closesAt === "string" ? new Date(body.closesAt) : undefined;
  // Danh sách trắng thay vì ép kiểu: giá trị lạ lọt xuống DB sẽ nổ ở tầng
  // Prisma với thông báo khó hiểu, mà bỏ qua thì âm thầm thành "theo gói đề".
  const revealAnswers =
    body?.revealAnswers === "immediately" ||
    body?.revealAnswers === "never" ||
    body?.revealAnswers === "after_close" ||
    body?.revealAnswers === "score_only"
      ? body.revealAnswers
      : undefined;
  const purpose =
    body?.purpose === "assessment" || body?.purpose === "field_test"
      ? body.purpose
      : undefined;

  try {
    const r = await shareExamLink(userId, params.id, {
      timingMode,
      durationMin,
      opensAt,
      closesAt,
      revealAnswers,
      purpose,
    });
    return NextResponse.json(r);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
