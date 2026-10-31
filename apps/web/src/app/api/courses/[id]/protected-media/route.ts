import { NextResponse } from "next/server";
import { setCourseProtectedMedia } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";
import { resetLessonMediaGuardCache } from "@/lib/lessonMediaGuard";

export const runtime = "nodejs";

// PUT /api/courses/[id]/protected-media — bật / tắt "Học liệu có bản quyền". Body: { enabled: boolean }.
// Chỉ chủ khoá và admin (đồng giảng viên sửa được nội dung nhưng không đổi chính sách bảo vệ).
export async function PUT(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { enabled?: unknown } | null;
  if (typeof body?.enabled !== "boolean") {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  try {
    const result = await setCourseProtectedMedia(userId, params.id, body.enabled);
    // Bản chạy này thấy thay đổi ngay; bản khác thấy sau tối đa PROTECTION_LOOKUP_TTL_MS.
    resetLessonMediaGuardCache();
    return NextResponse.json(result);
  } catch (e) {
    return mapKnownError(e) ?? (() => { throw e; })();
  }
}
