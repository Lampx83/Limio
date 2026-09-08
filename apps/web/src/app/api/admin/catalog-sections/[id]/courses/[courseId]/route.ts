import { NextResponse } from "next/server";
import { CatalogSectionError, removeCourseFromSection } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; courseId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await removeCourseFromSection(userId, params.id, params.courseId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof CatalogSectionError) {
      return NextResponse.json({ error: e.code }, { status: e.code === "forbidden" ? 403 : 400 });
    }
    throw e;
  }
}
