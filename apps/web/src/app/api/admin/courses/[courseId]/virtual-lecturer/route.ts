import { NextResponse } from "next/server";
import {
  VIRTUAL_LECTURER_MODES,
  VIRTUAL_LECTURERS,
  setCourseVirtualLecturerCode,
  setCourseVirtualLecturerMode,
  type VirtualLecturerModeValue,
} from "@feedbackme/core-lms";
import { requireAdmin } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

/**
 * Admin đặt giảng viên ảo riêng của khoá. Body: { mode?: mức | null, lecturerCode?: mã | null } — có khoá nào thì
 * đổi khoá đó; null = theo mặc định hệ thống. Phải có ít nhất một trong hai.
 */
export async function PATCH(req: Request, { params }: { params: { courseId: string } }) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await readJson(req)) as { mode?: unknown; lecturerCode?: unknown } | null;
  const hasMode = body !== null && "mode" in body;
  const hasCode = body !== null && "lecturerCode" in body;
  const mode = body?.mode;
  const code = body?.lecturerCode;
  if (
    (!hasMode && !hasCode) ||
    (hasMode && mode !== null && !(VIRTUAL_LECTURER_MODES as readonly unknown[]).includes(mode)) ||
    (hasCode && code !== null && !VIRTUAL_LECTURERS.some((l) => l.code === code))
  ) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  try {
    if (hasMode) await setCourseVirtualLecturerMode(adminId, params.courseId, mode as VirtualLecturerModeValue | null);
    if (hasCode) await setCourseVirtualLecturerCode(adminId, params.courseId, code as string | null);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
