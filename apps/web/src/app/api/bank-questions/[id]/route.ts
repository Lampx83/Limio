import { NextResponse } from "next/server";
import {
  deleteBankQuestion,
  ExamError,
  updateBankQuestion,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  try {
    const r = await updateBankQuestion(userId, params.id, body);
    return NextResponse.json(r);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

/**
 * Hard-delete câu hỏi. ?force=true để wipe luôn ExamQuestionFromBank
 * back-links khi câu đã được copy vào đề thi.
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
    const r = await deleteBankQuestion(userId, params.id, { force });
    return NextResponse.json(r);
  } catch (e) {
    // bank_question_in_use → 409 với usedCount để UI confirm prompt thêm.
    if (e instanceof ExamError && e.code === "bank_question_in_use") {
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
