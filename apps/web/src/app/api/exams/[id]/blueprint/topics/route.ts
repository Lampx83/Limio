import { NextResponse } from "next/server";
import { listTopicsInExamScope } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * Distinct topics available across all banks the actor can edit in the exam's
 * course, plus per-topic published-question count (for instructor visibility).
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const bankId = new URL(req.url).searchParams.get("bankId") ?? undefined;
    const topics = await listTopicsInExamScope(userId, params.id, undefined, bankId);
    return NextResponse.json({ topics });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
