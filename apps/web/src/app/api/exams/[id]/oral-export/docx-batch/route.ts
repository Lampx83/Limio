import { NextResponse } from "next/server";
import JSZip from "jszip";
import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { assertCanEditExam, CourseAuthzError } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { formatDateTime } from "@/lib/datetime";
import { contentDisposition } from "@/lib/examResultsWorkbook";
import { renderOralExamDocx } from "@/lib/oralExamDocx";
import {
  buildOralExamBatchName,
  buildOralExamFilename,
  createUniqueFilenames,
} from "@/lib/oralExamFilename";

export const runtime = "nodejs";

// POST chứ không GET: chọn cả lớp thì danh sách mã lượt thi dài quá giới hạn URL.
const bodySchema = z.object({
  // Không gửi = xuất mọi lượt đã kết thúc của đề.
  attemptIds: z.array(z.string().uuid()).min(1).optional(),
});

// A6.6 — Xuất Word các lượt vấn đáp đã kết thúc của 1 đề, theo lựa chọn của GV.
// Một lượt trả về thẳng file Word; từ hai lượt trở lên trả về 1 file .zip có một
// thư mục chứa file của từng người.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { attemptIds } = parsed.data;

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

  // Lọc theo examId nên mã lượt thi của đề khác gửi lên sẽ không khớp.
  const attempts = await prisma.examAttempt.findMany({
    where: {
      examId: exam.id,
      status: { in: ["submitted", "auto_submitted", "graded"] },
      ...(attemptIds ? { id: { in: attemptIds } } : {}),
    },
    select: {
      id: true,
      startedAt: true,
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
  const now = new Date();
  const generatedAtLabel = formatDateTime(now);

  const files: { name: string; buf: Buffer }[] = [];
  const uniqueName = createUniqueFilenames();
  for (const a of attempts) {
    const ev = a.oralEvaluation;
    const breakdown = Array.isArray(ev?.aiRubricBreakdown)
      ? (ev!.aiRubricBreakdown as unknown as { topic: string; note: string }[])
      : null;
    const graded = ev?.status === "approved" || ev?.status === "overridden";
    const studentName = a.user?.displayName ?? a.user?.email ?? "Sinh viên";

    const buf = await renderOralExamDocx({
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
    });

    files.push({
      name: uniqueName(
        buildOralExamFilename(studentName, a.submittedAt ?? a.startedAt, exam.title),
      ),
      buf,
    });
  }

  const onlyFile = files.length === 1 ? files[0] : undefined;
  if (onlyFile) {
    return new NextResponse(new Uint8Array(onlyFile.buf), {
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "content-disposition": contentDisposition(onlyFile.name),
        "content-length": String(onlyFile.buf.length),
      },
    });
  }

  const batchName = buildOralExamBatchName(exam.title, now);
  const zip = new JSZip();
  const folder = zip.folder(batchName)!;
  for (const file of files) folder.file(file.name, file.buf);

  const zipBuf = await zip.generateAsync({ type: "nodebuffer" });
  return new NextResponse(new Uint8Array(zipBuf), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": contentDisposition(`${batchName}.zip`),
      "content-length": String(zipBuf.length),
    },
  });
}
