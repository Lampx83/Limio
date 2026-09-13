import { NextResponse } from "next/server";
import { copyBankQuestionToExam } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** Body: { bankQuestionId, passageId?, sectionId?, orderInExam? } */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as
    | {
        bankQuestionId?: string;
        passageId?: string | null;
        sectionId?: string | null;
        orderInExam?: number;
      }
    | null;
  if (!body?.bankQuestionId)
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try {
    const r = await copyBankQuestionToExam(userId, body.bankQuestionId, params.id, {
      passageId: body.passageId ?? null,
      sectionId: body.sectionId ?? null,
      orderInExam: body.orderInExam,
    });
    return NextResponse.json(r, { status: 201 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
