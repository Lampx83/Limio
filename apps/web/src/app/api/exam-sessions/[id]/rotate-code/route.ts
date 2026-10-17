import { NextResponse } from "next/server";
import { rotateExamSessionOpenCode } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** Cấp mã chung mới cho ca Tự do (PR2.12 — mã thuộc ca, không thuộc đề). */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const r = await rotateExamSessionOpenCode(userId, params.id);
    return NextResponse.json(r);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
