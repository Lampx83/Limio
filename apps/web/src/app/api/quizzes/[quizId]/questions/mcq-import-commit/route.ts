import { NextResponse } from "next/server";
import {
  commitMcqRowsToQuiz,
  type ParsedMcqRow,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * Body: { rows: ParsedMcqRow[] }  — usually the array returned from
 * /mcq-import-preview (instructor có thể tick/untick rows trước commit).
 * Server skip rows status=error tự động.
 *
 * Auth: commitMcqRowsToQuiz → createQuestion → assertQuizEditAuth per call.
 */
export async function POST(
  req: Request,
  { params }: { params: { quizId: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await readJson(req)) as { rows?: ParsedMcqRow[] } | null;
  if (!body?.rows || !Array.isArray(body.rows)) {
    return NextResponse.json(
      { error: "validation_failed", details: "missing_rows" },
      { status: 400 },
    );
  }

  try {
    const r = await commitMcqRowsToQuiz(userId, params.quizId, body.rows);
    return NextResponse.json(r);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
