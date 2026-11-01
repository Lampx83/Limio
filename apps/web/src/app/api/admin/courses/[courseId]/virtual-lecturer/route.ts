import { NextResponse } from "next/server";
import {
  VIRTUAL_LECTURER_MODES,
  setCourseVirtualLecturerMode,
  type VirtualLecturerModeValue,
} from "@feedbackme/core-lms";
import { requireAdmin } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

/** Admin đặt mức giảng viên ảo riêng của khoá. Body: { mode: mức | null } — null = theo mặc định hệ thống. */
export async function PATCH(req: Request, { params }: { params: { courseId: string } }) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await readJson(req)) as { mode?: unknown } | null;
  const mode = body?.mode;
  if (mode !== null && !(VIRTUAL_LECTURER_MODES as readonly unknown[]).includes(mode)) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  try {
    await setCourseVirtualLecturerMode(adminId, params.courseId, mode as VirtualLecturerModeValue | null);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
