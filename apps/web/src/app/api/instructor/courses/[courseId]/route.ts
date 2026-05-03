import { NextResponse } from "next/server";
import { updateCourse, CourseError } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: { courseId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await readJson(req);
  try {
    await updateCourse(userId, params.courseId, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    if (e instanceof CourseError && e.code === "validation_failed") {
      return NextResponse.json({ error: "validation_failed", details: e.details }, { status: 422 });
    }
    throw e;
  }
}
