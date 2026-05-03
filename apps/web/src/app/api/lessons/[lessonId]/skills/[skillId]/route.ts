import { NextResponse } from "next/server";
import { untagLessonSkill } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export async function DELETE(
  _req: Request,
  { params }: { params: { lessonId: string; skillId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await untagLessonSkill(userId, params.lessonId, params.skillId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
