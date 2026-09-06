import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { assertCanEditCourse, CourseAuthzError } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { csvResponse } from "@/lib/csvExport";
import { identityCols, learnerIndex } from "@/lib/researchExport";

export const runtime = "nodejs";

/**
 * B13 — một dòng cho mỗi câu trả lời, kèm lớp và điều kiện thực nghiệm.
 *
 * Trước đây gradebook chỉ xuất ở mức lượt làm bài, nên hai biến quý nhất —
 * độ tự tin và thời gian nghĩ từng câu — không có đường nào ra khỏi hệ thống.
 */
export async function GET(
  _req: Request,
  { params }: { params: { courseId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await assertCanEditCourse(userId, params.courseId);
  } catch (err) {
    if (err instanceof CourseAuthzError) {
      return NextResponse.json(
        { error: err.code === "not_found" ? "course_not_found" : "forbidden" },
        { status: err.code === "not_found" ? 404 : 403 },
      );
    }
    throw err;
  }

  const course = await prisma.course.findUnique({
    where: { id: params.courseId },
    select: { slug: true },
  });
  if (!course) return NextResponse.json({ error: "course_not_found" }, { status: 404 });

  const [index, rows] = await Promise.all([
    learnerIndex(params.courseId),
    prisma.answerResponse.findMany({
      where: { attempt: { quiz: { courseId: params.courseId } } },
      select: {
        isCorrect: true,
        needsGrading: true,
        confidence: true,
        latencyMs: true,
        responseTimeMs: true,
        revisionCount: true,
        answeredAt: true,
        attempt: {
          select: { id: true, userId: true, startedAt: true, scorePct: true },
        },
        question: {
          select: {
            id: true,
            type: true,
            prompt: true,
            points: true,
            quiz: {
              select: {
                title: true,
                lesson: { select: { title: true, module: { select: { title: true } } } },
              },
            },
          },
        },
      },
      orderBy: [{ attempt: { startedAt: "asc" } }, { answeredAt: "asc" }],
    }),
  ]);

  const out = rows.map((r) => ({
    ...identityCols(index.get(r.attempt.userId)),
    Module: r.question.quiz.lesson?.module.title ?? "—",
    "Bài học": r.question.quiz.lesson?.title ?? "—",
    Quiz: r.question.quiz.title,
    "Mã lượt làm": r.attempt.id,
    "Mã câu hỏi": r.question.id,
    "Loại câu": r.question.type,
    // Cắt ngắn: đây là cột để nhận ra câu nào, không phải để đọc lại đề bài.
    "Đề bài (rút gọn)": r.question.prompt.replace(/\s+/g, " ").slice(0, 120),
    Điểm: r.question.points,
    "Đúng?": r.needsGrading ? "" : r.isCorrect,
    "Chờ chấm tay?": r.needsGrading,
    "Độ tự tin (1-5)": r.confidence ?? "",
    // Hai cột thời gian khác nghĩa nhau — xem docs B12.
    "Thời gian nghĩ câu này (ms)": r.latencyMs ?? "",
    "Thời gian từ đầu bài (ms)": r.responseTimeMs,
    "Số lần sửa đáp án": r.revisionCount,
    "Trả lời lúc": r.answeredAt,
    "Điểm cả lượt (%)": r.attempt.scorePct ?? "",
  }));

  const day = new Date().toISOString().slice(0, 10);
  return csvResponse(`nghien-cuu-dap-an-${course.slug}-${day}.csv`, out);
}
