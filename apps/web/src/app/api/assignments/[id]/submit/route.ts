import { NextResponse } from "next/server";
import { submitAssignment } from "@feedbackme/core-lms";
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
    return NextResponse.json(r);
  } catch (e) {
    const m = mapKnownError(e);
    if (m) return m;
    throw e;
  }
}
