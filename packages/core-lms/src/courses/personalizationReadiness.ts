import { prisma, type PrismaClient } from "@feedbackme/db";
import { assertCanEditCourse } from "./authz";

/**
 * AC1 (docs/tieu-chi/tu-hoc-ca-nhan-hoa-nxb.md) — khoá đã đủ điều kiện để cá nhân hoá chưa.
 *
 * Chỉ ĐỌC và chỉ thông tin: không chặn xuất bản, không đổi cờ, không sinh dữ liệu. Có hai việc:
 *  - `forSale`: khoá có đang bán không (đơn giá, gói đang bán, hoặc mã chưa thu hồi). Khoá bán mà tắt cá nhân hoá
 *    là tổ hợp nhà xuất bản dễ vướng nhất, vì khoá vẫn chạy như LMS thường nên không ai thấy mình thiếu gì.
 *  - bảng theo bài: bài nào có quiz, bao nhiêu câu, bao nhiêu câu có giải thích, bao nhiêu đáp án sai đã khai báo
 *    nhầm lẫn — những thứ làm phản hồi cá nhân hoá giàu hay nghèo.
 *
 * Khoá tắt cá nhân hoá không có bảng (không sinh chủ đề nào nên không có gì để đo).
 */

/** Dưới ngưỡng này (tổng số câu trong quiz gắn bài) thì bài bị đánh dấu "ít dữ liệu". */
export const READINESS_MIN_QUESTIONS = 3;

export interface LessonReadiness {
  lessonId: string;
  title: string;
  moduleTitle: string;
  quizCount: number;
  questionCount: number;
  /** Câu có lời giải thích riêng (không tính chuỗi chỉ có khoảng trắng). */
  explainedCount: number;
  /** Đáp án SAI đã gắn nhầm lẫn — đúng thứ giúp phản hồi gọi được tên chỗ nhầm. */
  misconceptionCount: number;
  thin: boolean;
}

export interface StandaloneQuizReadiness {
  quizId: string;
  title: string;
  questionCount: number;
}

export interface PersonalizationReadiness {
  enabled: boolean;
  forSale: boolean;
  lessons: LessonReadiness[];
  /** Quiz không gắn bài: không được gắn chủ đề tự động (gap có chủ ý, CLAUDE.md §4.4). */
  standaloneQuizzes: StandaloneQuizReadiness[];
}

export async function getPersonalizationReadiness(
  actorUserId: string,
  courseId: string,
  db: PrismaClient = prisma,
): Promise<PersonalizationReadiness> {
  await assertCanEditCourse(actorUserId, courseId, db);

  const course = await db.course.findUniqueOrThrow({
    where: { id: courseId },
    select: { priceCents: true, personalizationEnabled: true },
  });
  const [activePlans, liveCodes] = await Promise.all([
    db.courseAccessPlan.count({ where: { courseId, isActive: true } }),
    db.courseAccessCode.count({ where: { courseId, status: { not: "revoked" } } }),
  ]);
  const forSale = (course.priceCents ?? 0) > 0 || activePlans > 0 || liveCodes > 0;

  if (!course.personalizationEnabled) {
    return { enabled: false, forSale, lessons: [], standaloneQuizzes: [] };
  }

  const modules = await db.module.findMany({
    where: { courseId },
    orderBy: { orderIndex: "asc" },
    select: {
      title: true,
      lessons: { orderBy: { orderIndex: "asc" }, select: { id: true, title: true } },
    },
  });
  const lessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));

  // Quiz ẩn người học không làm được nên không góp dữ liệu cho cá nhân hoá.
  const quizzes = await db.quiz.findMany({
    where: { isHidden: false, OR: [{ courseId }, { lessonId: { in: lessonIds } }] },
    select: { id: true, title: true, lessonId: true, cuepointOnly: true },
  });
  const questions = await db.quizQuestion.findMany({
    where: { quizId: { in: quizzes.map((q) => q.id) } },
    select: {
      quizId: true,
      explanation: true,
      options: { select: { isCorrect: true, misconceptionId: true } },
    },
  });

  const byQuiz = new Map<string, typeof questions>();
  for (const q of questions) {
    const list = byQuiz.get(q.quizId) ?? [];
    list.push(q);
    byQuiz.set(q.quizId, list);
  }

  const lessons: LessonReadiness[] = modules.flatMap((m) =>
    m.lessons.map((l) => {
      const own = quizzes.filter((q) => q.lessonId === l.id);
      const qs = own.flatMap((q) => byQuiz.get(q.id) ?? []);
      return {
        lessonId: l.id,
        title: l.title,
        moduleTitle: m.title,
        quizCount: own.length,
        questionCount: qs.length,
        explainedCount: qs.filter((q) => (q.explanation ?? "").trim().length > 0).length,
        misconceptionCount: qs.reduce(
          (n, q) => n + q.options.filter((o) => !o.isCorrect && o.misconceptionId !== null).length,
          0,
        ),
        thin: qs.length < READINESS_MIN_QUESTIONS,
      };
    }),
  );

  const standaloneQuizzes: StandaloneQuizReadiness[] = quizzes
    .filter((q) => q.lessonId === null && !q.cuepointOnly)
    .map((q) => ({ quizId: q.id, title: q.title, questionCount: (byQuiz.get(q.id) ?? []).length }));

  return { enabled: true, forSale, lessons, standaloneQuizzes };
}
