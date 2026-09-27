/**
 * B4 (làm lại 2026-09-27) — lộ trình cá nhân hoá.
 *
 * Thay cho ba gợi ý rời (bỏ qua / ôn lại khi trượt 2 lần / bài kế tiếp theo
 * skill yếu). Ba gợi ý đó viết cho skill graph tay, nơi một chủ đề trải qua
 * nhiều bài; với lesson-as-tag mỗi chủ đề chỉ có đúng một bài — bài vừa học
 * xong — nên "bài chưa học có chủ đề yếu" gần như luôn rỗng.
 *
 * Cách mới: vì Feedback Engine không dùng quan hệ tiên quyết, **thứ tự bài GV
 * sắp chính là lộ trình nền**. Cá nhân hoá là chèn "ôn lại" và "lướt qua" lên
 * nền đó theo nhãn mức nắm vững của từng bài. Chỉ gợi ý, không chặn bài nào.
 */

import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import {
  LearningEventType,
  masteryLabel,
  type MasteryLabel,
} from "@feedbackme/shared-types";
import { resolveFeedbackVariant } from "./variant";

export const LEARNING_PATH_MAX_STEPS = 5;

/**
 * - `review`: đã học, Cần ôn
 * - `next`: bài chưa học kế tiếp theo thứ tự khoá
 * - `practice`: đã học, Nên luyện thêm
 * - `skim`: chưa học nhưng quiz đã cho thấy Vững — có thể lướt qua
 */
export type PathStepKind = "review" | "next" | "practice" | "skim";
export type PathSurface = "course_home" | "quiz_result";

export interface PathStep {
  kind: PathStepKind;
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  label: MasteryLabel;
  completed: boolean;
}

export interface LearningPath {
  enabled: boolean;
  reason?: "personalization_off" | "control_variant" | "not_enrolled" | "course_not_found";
  steps: PathStep[];
  /** Nhãn của mọi bài đang hiện trong khoá — trang kết quả quiz cần nhãn bài vừa làm. */
  labels: Record<string, MasteryLabel>;
}

const disabled = (reason: LearningPath["reason"]): LearningPath => ({
  enabled: false,
  reason,
  steps: [],
  labels: {},
});

export async function getLearningPath(
  userId: string,
  courseId: string,
  opts: { limit?: number } = {},
  db: PrismaClient = prisma,
): Promise<LearningPath> {
  const limit = opts.limit ?? LEARNING_PATH_MAX_STEPS;

  const [course, enrollment] = await Promise.all([
    db.course.findUnique({
      where: { id: courseId },
      select: { personalizationEnabled: true },
    }),
    db.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { id: true },
    }),
  ]);
  if (!course) return disabled("course_not_found");
  if (!course.personalizationEnabled) return disabled("personalization_off");
  if (!enrollment) return disabled("not_enrolled");
  // B10 — lộ trình là kênh cá nhân hoá lớn nhất; lớp đối chứng không được thấy.
  const { variant } = await resolveFeedbackVariant(userId, courseId, db);
  if (variant === "minimal") return disabled("control_variant");

  // Cùng bộ lọc với getCourseProgress: chỉ thứ học viên thấy được.
  const modules = await db.module.findMany({
    where: { courseId, isHidden: false },
    orderBy: { orderIndex: "asc" },
    select: {
      title: true,
      isLocked: true,
      lessons: {
        where: { isHidden: false },
        orderBy: { orderIndex: "asc" },
        select: { id: true, title: true, isLocked: true },
      },
    },
  });
  const lessons = modules.flatMap((m) =>
    m.lessons.map((l) => ({
      id: l.id,
      title: l.title,
      moduleTitle: m.title,
      locked: m.isLocked || l.isLocked,
    })),
  );
  const lessonIds = lessons.map((l) => l.id);

  const [mappings, completedRows] = await Promise.all([
    db.contentSkillMapping.findMany({
      where: { contentType: "lesson", contentId: { in: lessonIds } },
      select: { contentId: true, skillId: true },
    }),
    db.learningEvent.findMany({
      where: { userId, courseId, eventType: LearningEventType.LessonCompleted },
      select: { payload: true },
    }),
  ]);
  const skillsByLesson = new Map<string, string[]>();
  for (const m of mappings) {
    const list = skillsByLesson.get(m.contentId) ?? [];
    list.push(m.skillId);
    skillsByLesson.set(m.contentId, list);
  }
  const states = await db.learnerSkillState.findMany({
    where: {
      userId,
      skillId: { in: [...new Set(mappings.map((m) => m.skillId))] },
      attempts: { gte: 1 },
    },
    select: { skillId: true, masteryProbability: true },
  });
  const masteryBySkill = new Map(states.map((s) => [s.skillId, s.masteryProbability]));
  const completedSet = new Set<string>(
    completedRows.flatMap((r) => {
      const p = r.payload as { lessonId?: string } | null;
      return p?.lessonId ? [p.lessonId] : [];
    }),
  );

  const labels: Record<string, MasteryLabel> = {};
  const rows = lessons.map((l) => {
    const skillIds = skillsByLesson.get(l.id) ?? [];
    const known = skillIds
      .map((id) => masteryBySkill.get(id))
      .filter((p): p is number => p !== undefined);
    // Bài nhiều chủ đề (khoá cũ gắn tay) lấy chủ đề thấp nhất — nhãn phải
    // báo được chỗ yếu, không để chủ đề mạnh che đi.
    const label = masteryLabel(known.length > 0 ? Math.min(...known) : null);
    labels[l.id] = label;
    return {
      ...l,
      label,
      completed: completedSet.has(l.id),
      // Lướt qua cần căn cứ ở MỌI chủ đề, cùng quy tắc với shouldSkipLesson.
      fullyKnown: skillIds.length > 0 && known.length === skillIds.length,
    };
  });

  const open = rows.filter((r) => !r.locked);
  const step = (kind: PathStepKind) => (r: (typeof rows)[number]): PathStep => ({
    kind,
    lessonId: r.id,
    lessonTitle: r.title,
    moduleTitle: r.moduleTitle,
    label: r.label,
    completed: r.completed,
  });
  const isSkimmable = (r: (typeof rows)[number]) =>
    !r.completed && r.label === "solid" && r.fullyKnown;

  const review = open.filter((r) => r.completed && r.label === "needs_review");
  const next = open.find((r) => !r.completed && !isSkimmable(r));
  const practice = open.filter((r) => r.completed && r.label === "practice_more");
  const skim = open.filter(isSkimmable);

  const steps = [
    ...review.map(step("review")),
    ...(next ? [step("next")(next)] : []),
    ...practice.map(step("practice")),
    ...skim.map(step("skim")),
  ].slice(0, limit);

  return { enabled: true, steps, labels };
}

/** Ngày theo giờ VN (+07, không DST) — chính sách timezone toàn hệ thống. */
function vnDay(now: Date): string {
  return new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

/**
 * AC-2.13 — ghi rằng các bước này đã hiện ra trước mắt học viên. Mẫu số của
 * uptake: không biết gợi ý nào đã hiện thì tỉ lệ bấm không tính được.
 *
 * Mỗi (bài, loại bước, nhãn, nơi hiện) chỉ 1 event/ngày qua `eventKey`, để tải
 * lại trang không làm phình log. Loại bước và nhãn nằm trong khoá vì bài chuyển
 * từ "Chưa có dữ liệu" sang "Cần ôn" trong ngày là tín hiệu thật.
 */
export async function recordPathShown(
  userId: string,
  courseId: string,
  steps: PathStep[],
  surface: PathSurface,
  db: PrismaClient = prisma,
  now: Date = new Date(),
): Promise<void> {
  if (steps.length === 0) return;
  const day = vnDay(now);
  await db.learningEvent.createMany({
    data: steps.map((s, position) => ({
      eventKey: `adaptive.path.shown:${userId}:${surface}:${s.lessonId}:${s.kind}:${s.label}:${day}`,
      userId,
      courseId,
      eventType: LearningEventType.AdaptivePathUpdated,
      payload: {
        action: "shown",
        suggestionType: s.kind,
        targetLessonId: s.lessonId,
        surface,
        label: s.label,
        position,
      } as Prisma.InputJsonValue,
    })),
    skipDuplicates: true,
  });
}

export class PathClickError extends Error {
  constructor(public readonly code: "lesson_not_offered") {
    super(code);
  }
}

/**
 * AC-2.14 — học viên bấm vào một bước lộ trình.
 *
 * Endpoint do học viên gọi, nên chỉ nhận bài đã từng được gợi ý cho chính họ
 * (có event "shown") — nếu không ai cũng bơm được uptake cho bài bất kỳ. Không
 * dedupe: bấm lại là tín hiệu thật, như feedback.remediation.clicked.
 */
export async function recordPathClick(
  userId: string,
  lessonId: string,
  surface: PathSurface,
  kind: PathStepKind,
  db: PrismaClient = prisma,
): Promise<void> {
  const shown = await db.learningEvent.findFirst({
    where: {
      userId,
      eventType: LearningEventType.AdaptivePathUpdated,
      AND: [
        { payload: { path: ["action"], equals: "shown" } },
        { payload: { path: ["targetLessonId"], equals: lessonId } },
      ],
    },
    select: { courseId: true },
  });
  if (!shown) throw new PathClickError("lesson_not_offered");

  await db.learningEvent.create({
    data: {
      userId,
      courseId: shown.courseId,
      eventType: LearningEventType.AdaptivePathUpdated,
      payload: {
        action: "clicked",
        suggestionType: kind,
        targetLessonId: lessonId,
        surface,
      } as Prisma.InputJsonValue,
    },
  });
}
