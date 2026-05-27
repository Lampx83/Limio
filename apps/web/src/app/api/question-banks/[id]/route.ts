import { NextResponse } from "next/server";
import { deleteBank, updateBank, ExamError } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** Update bank metadata (name, description, codePrefix). */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  try {
    const r = await updateBank(userId, params.id, body);
    return NextResponse.json(r);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

/**
 * Hard-delete a QuestionBank. ?force=true to also wipe ExamQuestionFromBank
 * back-links when the bank's questions have been copied into exams.
 */
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const force = new URL(req.url).searchParams.get("force") === "true";
  try {
    const r = await deleteBank(userId, params.id, { force });
    return NextResponse.json(r);
  } catch (e) {
    // Surface bank_has_used_questions with 409 + count so UI can prompt.
    if (e instanceof ExamError && e.code === "bank_has_used_questions") {
      return NextResponse.json(
        { error: e.code, details: e.details },
        { status: 409 },
      );
    }
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
