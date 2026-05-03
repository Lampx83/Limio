import { NextResponse } from "next/server";
import { createAssignment } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export async function POST(
  req: Request,
  { params }: { params: { lessonId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  try {
    const r = await createAssignment(userId, params.lessonId, body);
    return NextResponse.json(r, { status: 201 });
  } catch (e) {
    const m = mapKnownError(e);
    if (m) return m;
    throw e;
  }
}
