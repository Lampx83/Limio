import { NextResponse } from "next/server";
import { submitAssignment } from "@feedbackme/core-lms";
import { onAssignmentDeepReflection } from "@feedbackme/core-gamification";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  try {
    const r = await submitAssignment(userId, params.id, body);
    const gamification = await onAssignmentDeepReflection({
      userId,
      // "" cho tournament không gắn khoá; handler short-circuit khi không có
      // self-rating/reflection nên không award XP sai.
      courseId: r.courseId ?? "",
      assignmentId: r.assignmentId,
      selfRating: r.selfRating,
      reflectionLength: r.reflectionLength,
    });
    return NextResponse.json({ ...r, gamification });
  } catch (e) {
    const m = mapKnownError(e);
    if (m) return m;
    throw e;
  }
}
