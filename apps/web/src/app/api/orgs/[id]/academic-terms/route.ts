import { NextResponse } from "next/server";
import { AcademicTermError, createAcademicTerm } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { academicTermErrorResponse, parseAcademicTermBody } from "@/lib/academicTermApi";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const input = await parseAcademicTermBody(req);
  if (!input) return NextResponse.json({ error: "validation_failed" }, { status: 400 });

  try {
    const term = await createAcademicTerm(userId, params.id, input);
    return NextResponse.json({ ok: true, term }, { status: 201 });
  } catch (e) {
    if (e instanceof AcademicTermError) return academicTermErrorResponse(e);
    throw e;
  }
}
