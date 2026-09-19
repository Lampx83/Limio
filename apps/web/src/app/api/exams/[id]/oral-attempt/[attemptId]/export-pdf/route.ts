import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@feedbackme/db";
import { CourseAuthzError, ExamError, getOralEvaluation } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { formatDateTime } from "@/lib/datetime";
import { OralExamPdfDocument, buildOralExamPdfFilename } from "@/lib/oralExamPdf";

export const runtime = "nodejs";

// A6.6 — Xuất PDF 1 phiên vấn đáp (hội thoại + điểm + nhận xét) để GV lưu
// trữ. Dùng chung authz + data loading với trang chấm chi tiết
// (getOralEvaluation đã tự kiểm tra quyền + exam.kind + attempt đã kết thúc).
export async function GET(
  _req: Request,
  { params }: { params: { id: string; attemptId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let view;
  try {
    view = await getOralEvaluation(userId, params.attemptId);
  } catch (e) {
    if (e instanceof CourseAuthzError) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (e instanceof ExamError) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    throw e;
  }

  const attempt = await prisma.examAttempt.findUnique({
    where: { id: params.attemptId },
    select: {
      submittedAt: true,
      user: { select: { displayName: true, email: true } },
      exam: {
        select: { id: true, title: true, courseId: true, course: { select: { title: true } } },
      },
    },
  });
  if (!attempt || attempt.exam.id !== params.id) {
    return NextResponse.json({ error: "attempt_not_found" }, { status: 404 });
  }

  const breakdown = Array.isArray(view.evaluation?.aiRubricBreakdown)
    ? (view.evaluation!.aiRubricBreakdown as unknown as { topic: string; note: string }[])
    : null;
  const graded = view.evaluation?.status === "approved" || view.evaluation?.status === "overridden";
  const studentName = attempt.user?.displayName ?? attempt.user?.email ?? "Sinh viên";

  const buf = await renderToBuffer(
    OralExamPdfDocument({
      examTitle: attempt.exam.title,
      courseTitle: attempt.exam.course?.title ?? null,
      studentName,
      studentEmail: attempt.user?.email ?? null,
      submittedAtLabel: attempt.submittedAt ? formatDateTime(attempt.submittedAt) : null,
      gradedAtLabel: view.evaluation?.gradedAt ? formatDateTime(view.evaluation.gradedAt) : null,
      graded,
      instructorScore: view.evaluation?.instructorScore ?? null,
      instructorNotes: view.evaluation?.instructorNotes ?? null,
      aiSuggestedScore: view.evaluation?.aiSuggestedScore ?? null,
      aiSummary: view.evaluation?.aiSummary ?? null,
      aiRubricBreakdown: breakdown,
      turns: view.turns.map((t) => ({ role: t.role as "examiner" | "student", content: t.content })),
      generatedAtLabel: formatDateTime(new Date()),
    }),
  );

  const filename = buildOralExamPdfFilename(attempt.exam.title, studentName, attempt.submittedAt);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "content-length": String(buf.length),
    },
  });
}
