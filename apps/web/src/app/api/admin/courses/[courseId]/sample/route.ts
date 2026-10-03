import { NextResponse } from "next/server";
import { setCourseSample } from "@feedbackme/core-lms";
import { requireAdmin } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

/** Admin bật/tắt "khoá mẫu". Body: { isSample: boolean }. */
export async function PATCH(
  req: Request,
  { params }: { params: { courseId: string } },
) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await readJson(req)) as { isSample?: unknown } | null;
  if (typeof body?.isSample !== "boolean") {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  try {
    await setCourseSample(adminId, params.courseId, body.isSample);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
