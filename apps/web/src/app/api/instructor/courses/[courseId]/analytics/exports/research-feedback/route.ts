import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { assertCanEditCourse, CourseAuthzError } from "@feedbackme/core-lms";
import { LearningEventType } from "@feedbackme/shared-types";
import { requireUserId } from "@/lib/session";
import { csvResponse } from "@/lib/csvExport";
import { identityCols, IDENTITY_COLUMNS, learnerIndex } from "@/lib/researchExport";

export const runtime = "nodejs";

/**
 * B13 — một dòng cho mỗi lượt phản hồi, kèm toạ độ SSMMD và chuyện người học
 * có bấm vào bài ôn hay không.
 *
 * `FeedbackDelivery` trước đây không có đường nào ra khỏi hệ thống: không
 * endpoint, không script, không trang quản trị nào đọc nó. Nghĩa là toàn bộ
 * công mã hoá toạ độ ở B9 nằm im trong cơ sở dữ liệu.
 *
 * `attemptId` là cột thường, không có khoá ngoại, nên phải tự lọc theo danh
 * sách lượt làm bài của khoá thay vì join thẳng.
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

  const attempts = await prisma.quizAttempt.findMany({
    where: { quiz: { courseId: params.courseId } },
    select: { id: true },
  });
  const attemptIds = attempts.map((a) => a.id);

  const [index, deliveries, clicks] = await Promise.all([
    learnerIndex(params.courseId),
    prisma.feedbackDelivery.findMany({
      where: { attemptId: { in: attemptIds } },
      orderBy: { deliveredAt: "asc" },
    }),
    // Uptake: học viên có bấm vào bài ôn được gợi ý không. Đây là biến trung
    // gian quan trọng nhất khi đánh giá feedback — feedback không được đọc thì
    // hiệu quả của nó không có gì để bàn.
    prisma.learningEvent.findMany({
      where: {
        courseId: params.courseId,
        eventType: LearningEventType.FeedbackRemediationClicked,
      },
      select: { payload: true },
    }),
  ]);

  const clickCount = new Map<string, number>();
  for (const e of clicks) {
    const id = (e.payload as { deliveryId?: string } | null)?.deliveryId;
    if (id) clickCount.set(id, (clickCount.get(id) ?? 0) + 1);
  }

  const out = deliveries.map((d) => {
    const ctx = (d.generationContext ?? {}) as {
      feedbackVariant?: string;
      sectionId?: string | null;
      misconceptionCode?: string | null;
      skillIds?: string[];
      masteryAtGeneration?: Record<string, number>;
      coderVersion?: string;
    };
    const remediation = Array.isArray(d.remediationLessonIds)
      ? (d.remediationLessonIds as string[])
      : [];
    const mastery = ctx.masteryAtGeneration
      ? Object.values(ctx.masteryAtGeneration)
      : [];
    const clicked = clickCount.get(d.id) ?? 0;

    return {
      ...identityCols(index.get(d.userId)),
      "Mã lượt phản hồi": d.id,
      "Mã lượt làm": d.attemptId ?? "",
      "Mã câu hỏi": d.questionId ?? "",
      // Điều kiện ghi lúc SINH, không suy ngược từ lớp hiện tại — chuyển lớp
      // giữa kỳ không được viết lại lịch sử (xem B10).
      "Điều kiện lúc sinh": ctx.feedbackVariant ?? "",
      "Tầng trội": d.level ?? "",
      "Mọi tầng có mặt": Array.isArray(d.levels) ? (d.levels as string[]).join("|") : "",
      "Mức chi tiết": d.elaboration ?? "",
      "Nguồn sinh": d.sourceKind ?? "",
      "Mã misconception": ctx.misconceptionCode ?? "",
      "Số bài ôn gợi ý": remediation.length,
      "Đã bấm vào bài ôn?": clicked > 0,
      "Số lần bấm": clicked,
      "Đánh giá (1-5)": d.rating ?? "",
      "Mastery trung bình lúc sinh":
        mastery.length > 0
          ? Math.round((mastery.reduce((a, b) => a + b, 0) / mastery.length) * 1000) / 1000
          : "",
      "Phiên bản bộ mã hoá": ctx.coderVersion ?? "",
      "Nội dung phản hồi": d.body.replace(/\s+/g, " "),
      "Sinh lúc": d.deliveredAt,
    };
  });

  const day = new Date().toISOString().slice(0, 10);
  // Khai báo cột sẵn: khoá chưa ai làm quiz sai thì chưa có lượt phản hồi nào,
  // và một tệp trắng trơn trông y hệt một lần tải hỏng.
  return csvResponse(`nghien-cuu-phan-hoi-${course.slug}-${day}.csv`, out, [
    ...IDENTITY_COLUMNS,
    "Mã lượt phản hồi",
    "Mã lượt làm",
    "Mã câu hỏi",
    "Điều kiện lúc sinh",
    "Tầng trội",
    "Mọi tầng có mặt",
    "Mức chi tiết",
    "Nguồn sinh",
    "Mã misconception",
    "Số bài ôn gợi ý",
    "Đã bấm vào bài ôn?",
    "Số lần bấm",
    "Đánh giá (1-5)",
    "Mastery trung bình lúc sinh",
    "Phiên bản bộ mã hoá",
    "Nội dung phản hồi",
    "Sinh lúc",
  ]);
}
