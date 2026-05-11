import { NextResponse } from "next/server";
import { reorderExamQuestions } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as {
    passageId?: string | null;
    orderedQuestionIds?: string[];
  } | null;
  if (
    !body ||
    !Array.isArray(body.orderedQuestionIds) ||
    (body.passageId !== null &&
      body.passageId !== undefined &&
      typeof body.passageId !== "string")
  ) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  try {
    await reorderExamQuestions(
      userId,
      params.id,
      body.passageId ?? null,
      body.orderedQuestionIds,
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
