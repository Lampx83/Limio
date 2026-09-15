import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { canEditExam, parseExamQuestionsXlsx } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — generous, .xlsx is small

/**
 * Preview a question import. Parses the uploaded xlsx, resolves passage titles
 * + skill codes against the exam, and returns per-row status + summary.
 * Does NOT touch the DB beyond read-only lookups.
 *
 * Body: multipart/form-data { file: <xlsx> }
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
  // Lock down to the same draftable/no-attempts window as ContentManager.
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
  // .xlsx ZIP signature check — reject CSV/ODS early with a helpful message.
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (head[0] !== 0x50 || head[1] !== 0x4b) {
    return NextResponse.json(
      { error: "invalid_xlsx", details: "Vui lòng dùng file .xlsx (Excel) — CSV/ODS chưa hỗ trợ." },
      { status: 415 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());

  // Load all skills referenced in the course's content as a starting set;
  // also include any skill code at all (cheap query) so cross-course bank items
  // resolve. The parser only validates membership, not authorization.
  const skills = await prisma.skill.findMany({
    select: { id: true, code: true },
  });
  const existingSkillCodes = new Set(skills.map((s) => s.code));
  const skillIdByCode = new Map(skills.map((s) => [s.code, s.id]));

  try {
    const result = parseExamQuestionsXlsx(buf, {
      existingPassages: exam.passages,
      existingSkillCodes,
      skillIdByCode,
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "parse_failed", details: msg },
      { status: 400 },
    );
  }
}
