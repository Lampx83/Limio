import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { canEditExam, commitExamQuestionRows, parseExamQuestionsXlsx } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Bulk-insert imported questions into the exam after preview review.
 * Re-parses the uploaded file (we don't trust client-sent rows) and commits
 * rows whose status passes the chosen filter via `commitExamQuestionRows`
 * (per-row: ghi được bao nhiêu ghi bấy nhiêu, báo lỗi từng dòng — không bọc
 * transaction cả batch).
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

  // commitExamQuestionRows ghi được bao nhiêu ghi bấy nhiêu, báo lỗi từng
  // dòng — khác transaction all-or-nothing trước đây (xem comment trong
  // commitToExam.ts). Gộp lỗi ghi (hiếm — vd FK passageId lạ) vào cùng field
  // `errors` với lỗi validate để không đổi shape response phía client.
  const { imported, errors: writeErrors } = await commitExamQuestionRows(
    userId,
    exam.id,
    toInsert,
  );
  const errors = [
    ...errorRows,
    ...writeErrors.map((e) => ({ rowNumber: e.rowNumber, errors: [e.message] })),
  ];

  return NextResponse.json({
    imported,
    skippedError: result.summary.error,
    skippedWarning: includeWarnings ? 0 : result.summary.warning,
    errors,
  });
}
