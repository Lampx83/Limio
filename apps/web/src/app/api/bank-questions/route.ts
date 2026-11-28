import { NextResponse } from "next/server";
import { bankQuestionIdsInExam, canEditExam, searchQuestions } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/** Cross-bank search. Query params: type, difficulty, skill, q, status, cursor, excludeInExam. */
export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const numList = (k: string) =>
    sp.getAll(k).map((s) => Number(s)).filter((n) => Number.isFinite(n));
  // `excludeInExam=<examId>`: ẩn câu đã chép vào đề đó (màn Chọn thủ công).
  // Chỉ người sửa được đề mới được hỏi, kẻo lộ đề dùng câu nào.
  let excludeIds: string[] | undefined;
  const excludeInExam = sp.get("excludeInExam");
  if (excludeInExam) {
    const exam = await prisma.exam.findUnique({
      where: { id: excludeInExam },
      select: { id: true, courseId: true, createdById: true },
    });
    if (!exam || !(await canEditExam(userId, exam)))
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    excludeIds = await bankQuestionIdsInExam(exam.id);
  }
  const r = await searchQuestions(userId, {
    excludeIds,
    type: sp.getAll("type"),
    difficulty: numList("difficulty"),
    skillIds: sp.getAll("skill"),
    bankIds: sp.getAll("bank"),
    topics: sp.getAll("topic"),
    q: sp.get("q") ?? undefined,
    status: sp.getAll("status") as ("draft" | "published" | "archived")[],
    cursor: sp.get("cursor") ?? undefined,
    limit: Number(sp.get("limit") ?? "30"),
  });
  return NextResponse.json(r);
}
