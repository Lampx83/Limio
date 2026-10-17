import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { describeWeights, listSessionRosterResults, loadScoringPlan } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";
import {
  answerCell,
  buildSessionRosterWorkbook,
  contentDisposition,
  examResultsFilename,
} from "@/lib/examResultsWorkbook";

export const runtime = "nodejs";

/**
 * GET /api/exam-sessions/[id]/results-export — "Bảng điểm ca thi" (.xlsx).
 *
 * Mỗi dòng một thí sinh của ca, kể cả em chưa vào thi; có mã lớp học, mã lớp
 * thi. Dùng chung cho ca trong đợt và ca lẻ. Xem listSessionRosterResults.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let roster;
  try {
    roster = await listSessionRosterResults(userId, params.id);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }

  const questions = await prisma.examQuestion.findMany({
    where: { examId: roster.examId },
    orderBy: { orderInExam: "asc" },
    select: { id: true, orderInExam: true, points: true },
  });
  const attemptIds = roster.rows.flatMap((r) => (r.attemptId ? [r.attemptId] : []));
  const answers = attemptIds.length
    ? await prisma.examAnswer.findMany({
        where: { attemptId: { in: attemptIds } },
        select: { attemptId: true, questionId: true, autoScore: true, manualScore: true, needsGrading: true },
      })
    : [];
  const byKey = new Map(answers.map((a) => [`${a.attemptId}:${a.questionId}`, a]));

  // Đề chia từ 2 phần trở lên: thêm cột điểm thô của từng phần để đối chiếu với trọng số.
  const plan = await loadScoringPlan(roster.examId, prisma);
  const sections = plan.sections.length >= 2 ? plan.sections : [];
  const sectionCellsFor = (attemptId: string | null): Array<number | string> =>
    sections.map((sec) => {
      if (!attemptId) return "—";
      const mine = sec.questionIds.map((id) => byKey.get(`${attemptId}:${id}`));
      if (mine.some((a) => a?.needsGrading)) return "Chờ chấm";
      const sum = mine.reduce((s, a) => s + (a ? (a.manualScore ?? a.autoScore ?? 0) : 0), 0);
      return Math.round(sum * 100) / 100;
    });

  const exportedAt = new Date();
  const buf = await buildSessionRosterWorkbook({
    examTitle: roster.examTitle,
    sessionTitle: roster.sessionTitle,
    exportedAt,
    totalPoints: roster.totalPoints,
    weightsNote: describeWeights(plan),
    sections: sections.map((sec) => ({ title: sec.title, maxPoints: sec.maxPoints, weight: plan.weighted ? sec.weight : null })),
    questions: questions.map((q) => ({ number: q.orderInExam + 1, points: q.points })),
    rows: roster.rows.map((row) => ({
      row,
      sectionCells: sectionCellsFor(row.attemptId),
      cells: questions.map((q) =>
        answerCell(row.attemptId ? byKey.get(`${row.attemptId}:${q.id}`) : undefined, q.points),
      ),
    })),
  });

  const name = examResultsFilename(
    "Bảng điểm",
    `${roster.examTitle} - ${roster.sessionTitle}`,
    exportedAt,
    "xlsx",
  );
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": contentDisposition(name),
      "Content-Length": String(buf.length),
    },
  });
}
