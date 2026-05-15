import { NextResponse } from "next/server";
import { addCohortExamClass } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  try {
    const row = await addCohortExamClass(userId, params.id, body);
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
