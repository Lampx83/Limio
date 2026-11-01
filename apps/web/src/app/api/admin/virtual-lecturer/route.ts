import { NextResponse } from "next/server";
import {
  VIRTUAL_LECTURER_MODES,
  getVirtualLecturerSettings,
  setVirtualLecturerSettings,
  type VirtualLecturerModeValue,
} from "@feedbackme/core-lms";
import { requireAdmin } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** Cài đặt giảng viên ảo của hệ thống — chỉ admin. */
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json(await getVirtualLecturerSettings());
}

/** Body: { enabled?: boolean, defaultMode?: mức, defaultLecturer?: mã giảng viên }. */
export async function PATCH(req: Request) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await readJson(req)) as {
    enabled?: unknown;
    defaultMode?: unknown;
    defaultLecturer?: unknown;
  } | null;
  if (
    !body ||
    (body.enabled !== undefined && typeof body.enabled !== "boolean") ||
    (body.defaultMode !== undefined &&
      !(VIRTUAL_LECTURER_MODES as readonly unknown[]).includes(body.defaultMode)) ||
    (body.defaultLecturer !== undefined && typeof body.defaultLecturer !== "string")
  ) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  try {
    const settings = await setVirtualLecturerSettings(adminId, {
      enabled: body.enabled as boolean | undefined,
      defaultMode: body.defaultMode as VirtualLecturerModeValue | undefined,
      defaultLecturer: body.defaultLecturer as string | undefined,
    });
    return NextResponse.json(settings);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
