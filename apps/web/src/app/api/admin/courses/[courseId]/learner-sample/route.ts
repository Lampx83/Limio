import { NextResponse } from "next/server";
import { setCourseLearnerSample } from "@feedbackme/core-lms";
import { requireAdmin } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

/** Admin bật/tắt "khoá mẫu cho học viên" (thẻ "Thử học ngay" ở trang Bắt đầu). Body: { on: boolean }. */
export async function PATCH(
  req: Request,
  { params }: { params: { courseId: string } },
) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await readJson(req)) as { on?: unknown } | null;
  if (typeof body?.on !== "boolean") {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  try {
    await setCourseLearnerSample(adminId, params.courseId, body.on);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
