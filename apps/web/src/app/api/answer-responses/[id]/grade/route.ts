import { NextResponse } from "next/server";
import { gradeEssayResponse, QuizError } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { score?: number; isCorrect?: boolean } | null;
  if (!body || typeof body.score !== "number") {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  try {
    await gradeEssayResponse(userId, params.id, {
      score: body.score,
      isCorrect: body.isCorrect,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof QuizError) {
      const status =
        e.code === "validation_failed"
          ? 400
          : e.code === "attempt_belongs_to_other"
            ? 403
            : 400;
      return NextResponse.json({ error: e.code }, { status });
    }
    throw e;
  }
}
