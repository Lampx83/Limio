import { NextResponse } from "next/server";
import { createVanDapExam, listLegacyOralImportCandidates, listVanDapExams } from "@feedbackme/core-lms";
import { readJson } from "@/lib/apiHelpers";
import { withVanDap } from "@/lib/vanDapApi";

export const runtime = "nodejs";

/** Danh sách đề Limio Vấn đáp của giảng viên + các đề vấn đáp cũ có thể nhập (AC0.2, AC0.4). */
export function GET() {
  return withVanDap(async (userId) => {
    const [exams, legacy] = await Promise.all([listVanDapExams(userId), listLegacyOralImportCandidates(userId)]);
    return NextResponse.json({ exams, legacy });
  });
}

/** Body: { title, language?, durationMin?, courseId? } */
export function POST(req: Request) {
  return withVanDap(async (userId) => {
    const body = (await readJson(req)) as Record<string, unknown> | null;
    const r = await createVanDapExam(userId, (body ?? {}) as never);
    return NextResponse.json(r, { status: 201 });
  });
}
