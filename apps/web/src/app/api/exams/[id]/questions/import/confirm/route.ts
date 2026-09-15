import { NextResponse } from "next/server";
import { Prisma, prisma, type ExamQuestionType } from "@feedbackme/db";
import { canEditExam, parseExamQuestionsXlsx } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Bulk-insert imported questions into the exam after preview review.
 * Re-parses the uploaded file (we don't trust client-sent rows) and inserts
 * rows whose status passes the chosen filter inside a single transaction.
 *
 * Body: multipart/form-data { file: <xlsx>, includeWarnings: "true"|"false" }
 * Returns: { imported, skippedError, skippedWarning, errors: [{rowNumber, errors[]}] }
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const exam = await prisma.exam.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      courseId: true,
      createdById: true,
      status: true,
      passages: { select: { id: true, title: true }, orderBy: { orderIndex: "asc" } },
      _count: { select: { attempts: true } },
    },
  });
  if (!exam) return NextResponse.json({ error: "exam_not_found" }, { status: 404 });
  if (!(await canEditExam(userId, exam))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (exam.status === "published" && exam._count.attempts > 0) {
    return NextResponse.json({ error: "exam_has_attempts" }, { status: 409 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
  }
  const file = form.get("file");
  const includeWarnings = form.get("includeWarnings") === "true";
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: "validation_failed", details: "no_file" },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", details: { maxBytes: MAX_BYTES } },
      { status: 413 },
    );
  }
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (head[0] !== 0x50 || head[1] !== 0x4b) {
    return NextResponse.json(
      { error: "invalid_xlsx" },
      { status: 415 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const skills = await prisma.skill.findMany({ select: { id: true, code: true } });
  const skillIdByCode = new Map(skills.map((s) => [s.code, s.id]));
  const result = parseExamQuestionsXlsx(buf, {
    existingPassages: exam.passages,
    existingSkillCodes: new Set(skills.map((s) => s.code)),
    skillIdByCode,
  });

  // Decide which rows to insert.
  const toInsert = result.rows.filter((r) =>
    includeWarnings
      ? r.status !== "error" && r.parsed
      : r.status === "ok" && r.parsed,
  );

  const errorRows = result.rows
    .filter((r) => r.status === "error")
    .map((r) => ({ rowNumber: r.rowNumber, errors: r.errors }));

  if (toInsert.length === 0) {
    return NextResponse.json({
      imported: 0,
      skippedError: result.summary.error,
      skippedWarning: includeWarnings ? 0 : result.summary.warning,
      errors: errorRows,
    });
  }

  // Compute starting order indices once, then increment in memory.
  const baseExamOrder = await prisma.examQuestion.count({
    where: { examId: exam.id },
  });
  const passageOrderCounts = new Map<string, number>();
  for (const p of exam.passages) {
    const n = await prisma.examQuestion.count({
      where: { examId: exam.id, passageId: p.id },
    });
    passageOrderCounts.set(p.id, n);
  }

  let imported = 0;
  await prisma.$transaction(async (tx) => {
    let nextExamOrder = baseExamOrder;
    for (const row of toInsert) {
      const p = row.parsed!;
      const orderInPassage = p.passageId
        ? (passageOrderCounts.get(p.passageId) ?? 0)
        : null;
      if (p.passageId) {
        passageOrderCounts.set(p.passageId, (passageOrderCounts.get(p.passageId) ?? 0) + 1);
      }
      const q = await tx.examQuestion.create({
        data: {
          examId: exam.id,
          passageId: p.passageId,
          type: p.type as ExamQuestionType,
          prompt: p.prompt,
          config: p.config as Prisma.InputJsonValue,
          points: p.points,
          orderInExam: nextExamOrder++,
          orderInPassage,
        },
        select: { id: true },
      });
      if (p.skillIds.length > 0) {
        await tx.examQuestionSkillTag.createMany({
          data: p.skillIds.map((skillId) => ({ questionId: q.id, skillId })),
          skipDuplicates: true,
        });
      }
      imported++;
    }
  });

  return NextResponse.json({
    imported,
    skippedError: result.summary.error,
    skippedWarning: includeWarnings ? 0 : result.summary.warning,
    errors: errorRows,
  });
}
