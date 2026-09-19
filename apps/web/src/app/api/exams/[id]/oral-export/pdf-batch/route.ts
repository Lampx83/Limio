import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import JSZip from "jszip";
import { prisma } from "@feedbackme/db";
import { assertCanEditExam, CourseAuthzError, slugify } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { formatDateTime } from "@/lib/datetime";
import { OralExamPdfDocument, buildOralExamPdfFilename } from "@/lib/oralExamPdf";

export const runtime = "nodejs";

// A6.6 — Xuất PDF hàng loạt (1 file .zip, mỗi lượt 1 PDF) cho toàn bộ lượt
// đã kết thúc của 1 đề vấn đáp — để GV lưu trữ cả lớp cùng lúc.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const exam = await prisma.exam.findUnique({
    where: { id: params.id },
    select: { id: true, title: true, courseId: true, createdById: true, kind: true },
  });
  if (!exam) return NextResponse.json({ error: "exam_not_found" }, { status: 404 });
  if (exam.kind !== "oral") {
    return NextResponse.json({ error: "exam_not_oral" }, { status: 400 });
  }
  try {
    await assertCanEditExam(userId, exam);
  } catch (e) {
    if (e instanceof CourseAuthzError) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    throw e;
  }

  const attempts = await prisma.examAttempt.findMany({
    where: { examId: exam.id, status: { in: ["submitted", "auto_submitted", "graded"] } },
    select: {
      id: true,
      submittedAt: true,
      user: { select: { displayName: true, email: true } },
      oralEvaluation: true,
      oralTurns: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { submittedAt: "asc" },
  });

  if (attempts.length === 0) {
    return NextResponse.json({ error: "no_attempts" }, { status: 404 });
  }

  const courseTitle = exam.courseId
    ? (await prisma.course.findUnique({ where: { id: exam.courseId }, select: { title: true } }))
        ?.title ?? null
    : null;
  const generatedAtLabel = formatDateTime(new Date());

  const zip = new JSZip();
  const usedNames = new Map<string, number>();
  for (const a of attempts) {
    const ev = a.oralEvaluation;
    const breakdown = Array.isArray(ev?.aiRubricBreakdown)
      ? (ev!.aiRubricBreakdown as unknown as { topic: string; note: string }[])
      : null;
    const graded = ev?.status === "approved" || ev?.status === "overridden";
    const studentName = a.user?.displayName ?? a.user?.email ?? "Sinh viên";

    const buf = await renderToBuffer(
      OralExamPdfDocument({
        examTitle: exam.title,
        courseTitle,
        studentName,
        studentEmail: a.user?.email ?? null,
        submittedAtLabel: a.submittedAt ? formatDateTime(a.submittedAt) : null,
        gradedAtLabel: ev?.gradedAt ? formatDateTime(ev.gradedAt) : null,
        graded,
        instructorScore: ev?.instructorScore ?? null,
        instructorNotes: ev?.instructorNotes ?? null,
        aiSuggestedScore: ev?.aiSuggestedScore ?? null,
        aiSummary: ev?.aiSummary ?? null,
        aiRubricBreakdown: breakdown,
        turns: a.oralTurns.map((t) => ({ role: t.role as "examiner" | "student", content: t.content })),
        generatedAtLabel,
      }),
    );

    let name = buildOralExamPdfFilename(exam.title, studentName, a.submittedAt);
    const seen = usedNames.get(name) ?? 0;
    usedNames.set(name, seen + 1);
    if (seen > 0) {
      name = name.replace(/\.pdf$/, `_${seen + 1}.pdf`);
    }
    zip.file(name, buf);
  }

  const zipBuf = await zip.generateAsync({ type: "nodebuffer" });
  const dateStr = new Date().toISOString().slice(0, 10);
  const zipName = `vandap_${slugify(exam.title) || "de-thi"}_${dateStr}.zip`;
  return new NextResponse(new Uint8Array(zipBuf), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${zipName}"`,
      "content-length": String(zipBuf.length),
    },
  });
}
