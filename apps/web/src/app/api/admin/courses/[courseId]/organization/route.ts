import { NextResponse } from "next/server";
import { CourseOrgError, setCourseOrganization } from "@feedbackme/core-lms";
import { requireAdmin } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";

/**
 * Admin gắn/gỡ khoá khỏi tổ chức (docs/tieu-chi/bao-cao-nha-xuat-ban.md, AC8).
 * Body: { organizationId: string | null }. null = gỡ khỏi tổ chức.
 */
export async function PATCH(req: Request, { params }: { params: { courseId: string } }) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await readJson(req)) as { organizationId?: unknown } | null;
  const organizationId = body?.organizationId;
  if (!(organizationId === null || (typeof organizationId === "string" && organizationId.length > 0))) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  try {
    const r = await setCourseOrganization(adminId, params.courseId, organizationId);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    if (e instanceof CourseOrgError) {
      const status = e.code === "forbidden" ? 403 : 404;
      return NextResponse.json({ error: e.code }, { status });
    }
    throw e;
  }
}
