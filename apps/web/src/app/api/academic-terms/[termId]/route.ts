import { NextResponse } from "next/server";
import { AcademicTermError, deleteAcademicTerm, updateAcademicTerm } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { academicTermErrorResponse, parseAcademicTermBody } from "@/lib/academicTermApi";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: { termId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const input = await parseAcademicTermBody(req);
  if (!input) return NextResponse.json({ error: "validation_failed" }, { status: 400 });

  try {
    const term = await updateAcademicTerm(userId, params.termId, input);
    return NextResponse.json({ ok: true, term });
  } catch (e) {
    if (e instanceof AcademicTermError) return academicTermErrorResponse(e);
    throw e;
  }
}

export async function DELETE(_req: Request, { params }: { params: { termId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    await deleteAcademicTerm(userId, params.termId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AcademicTermError) return academicTermErrorResponse(e);
    throw e;
  }
}
