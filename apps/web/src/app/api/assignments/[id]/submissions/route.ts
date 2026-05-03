import { NextResponse } from "next/server";
import { listSubmissionsForInstructor } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const submissions = await listSubmissionsForInstructor(userId, params.id);
    return NextResponse.json({ submissions });
  } catch (e) {
    const m = mapKnownError(e);
    if (m) return m;
    throw e;
  }
}
