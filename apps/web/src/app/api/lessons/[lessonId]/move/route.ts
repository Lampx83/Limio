import { NextResponse } from "next/server";
import { moveLessonToModule } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export async function PATCH(
  req: Request,
  { params }: { params: { lessonId: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { moduleId?: string } | null;
  if (!body?.moduleId || typeof body.moduleId !== "string") {
    return NextResponse.json(
      { error: "validation_failed", message: "moduleId required" },
      { status: 400 },
    );
  }
  try {
    await moveLessonToModule(userId, params.lessonId, body.moduleId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
