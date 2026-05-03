import { NextResponse } from "next/server";
import { getAttemptResult } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export async function GET(
  _req: Request,
  { params }: { params: { attemptId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const data = await getAttemptResult(userId, params.attemptId);
    return NextResponse.json(data);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
