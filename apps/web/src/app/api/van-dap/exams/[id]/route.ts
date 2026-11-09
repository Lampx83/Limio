import { NextResponse } from "next/server";
import { deleteVanDapExam, getVanDapExamForEditor, updateVanDapExam } from "@feedbackme/core-lms";
import { readJson } from "@/lib/apiHelpers";
import { withVanDap } from "@/lib/vanDapApi";

export const runtime = "nodejs";

export function GET(_req: Request, { params }: { params: { id: string } }) {
  return withVanDap(async (userId) => NextResponse.json(await getVanDapExamForEditor(userId, params.id)));
}

/** Body: bất kỳ trong { title, language, durationMin, toneNote, rubricText }. Sau khi xuất bản chỉ toneNote và rubricText. */
export function PATCH(req: Request, { params }: { params: { id: string } }) {
  return withVanDap(async (userId) => {
    const body = (await readJson(req)) as Record<string, unknown> | null;
    await updateVanDapExam(userId, params.id, (body ?? {}) as never);
    return NextResponse.json({ ok: true });
  });
}

export function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return withVanDap(async (userId) => {
    await deleteVanDapExam(userId, params.id);
    return NextResponse.json({ ok: true });
  });
}
