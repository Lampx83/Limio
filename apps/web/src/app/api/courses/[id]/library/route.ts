import { NextResponse } from "next/server";
import { updateCourseLibraryMeta } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

// PUT /api/courses/[id]/library — đặt thông tin Thư viện giáo trình của khoá. Body: bất kỳ trong
// { inLibrary, publisher, authors, edition, levelBand, focusTags }; trường vắng mặt giữ nguyên.
// Chỉ chủ khoá và admin (đồng giảng viên sửa nội dung nhưng không đổi cách khoá được hiển thị/bán).
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  try {
    return NextResponse.json(await updateCourseLibraryMeta(userId, params.id, body as Record<string, unknown>));
  } catch (e) {
    return mapKnownError(e) ?? (() => { throw e; })();
  }
}
