import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";

const REMEDIATION_LIMIT = 3;

interface PerWrongAnswer {
  questionId: string;
  templateId: string | null;
  body: string;
  remediationLessonIds: string[];
  misconceptionCode: string | null;
}

export interface DiagnosticResult {
  deliveries: PerWrongAnswer[];
}

/**
 * For each wrong answer in the attempt, build feedback (templated text +
 * remediation lessons) and persist a FeedbackDelivery row. Returns the
 * payload so the API can surface it on the result page.
 *
 * Strategy:
 *  - misconception code → per-misconception template (if exists), else generic
 *  - remediation = top 3 lessons in this course tagged with the question's
 *    skills, by coverageWeight desc, excluding lessons the user already completed
 */
export async function generateDiagnosticFeedback(
  userId: string,
  attemptId: string,
  db: PrismaClient = prisma,
): Promise<DiagnosticResult> {
  const attempt = await db.quizAttempt.findUnique({
    where: { id: attemptId },
    select: { quizId: true, quiz: { select: { courseId: true } } },
  });
  if (!attempt || !attempt.quiz.courseId) return { deliveries: [] };
  const courseId = attempt.quiz.courseId;

  const wrongResponses = await db.answerResponse.findMany({
    where: { attemptId, isCorrect: false },
    select: {
      response: true,
      questionId: true,
      question: {
        select: {
          id: true,
          options: {
            select: {
              id: true,
              isCorrect: true,
              misconceptionId: true,
              misconception: { select: { id: true, code: true } },
            },
          },
          skillTags: { select: { skillId: true } },
        },
      },
    },
  });

  // Lessons already completed by this user in this course (for exclusion).
  const completed = await db.learningEvent.findMany({
    where: {
      userId,
      courseId,
      eventType: LearningEventType.LessonCompleted,
    },
    select: { payload: true },
  });
  const completedLessonIds = new Set<string>(
    completed.flatMap((r) => {
      const p = r.payload as { lessonId?: string } | null;
      return p?.lessonId ? [p.lessonId] : [];
    }),
  );

  // Generic fallback template — looked up once.
  const genericTemplate = await db.feedbackTemplate.findFirst({
    where: { scope: "generic" },
    orderBy: { priority: "asc" },
  });

  const deliveries: PerWrongAnswer[] = [];
  for (const r of wrongResponses) {
    // Find the misconception attached to the wrong option the learner picked.
    let misconceptionId: string | null = null;
    let misconceptionCode: string | null = null;
    if (Array.isArray(r.response)) {
      const selectedIds = r.response.filter(
        (x): x is string => typeof x === "string",
      );
      const wrongPicked = r.question.options.find(
        (o) =>
          !o.isCorrect &&
          o.misconceptionId &&
          selectedIds.includes(o.id),
      );
      if (wrongPicked?.misconception) {
        misconceptionId = wrongPicked.misconception.id;
        misconceptionCode = wrongPicked.misconception.code;
      }
    }

    // Resolve template: per-misconception → generic.
    let template = misconceptionId
      ? await db.feedbackTemplate.findFirst({
          where: { scope: "per_misconception", misconceptionId },
          orderBy: { priority: "asc" },
        })
      : null;
    if (!template) template = genericTemplate;

    // Remediation lessons: same course, tagged with any of the question's skills,
    // excluding ones already completed.
    const skillIds = r.question.skillTags.map((t) => t.skillId);
    let remediationLessonIds: string[] = [];
    if (skillIds.length > 0) {
      const mappings = await db.contentSkillMapping.findMany({
        where: {
          contentType: "lesson",
          skillId: { in: skillIds },
          lesson: { module: { courseId } },
        },
        orderBy: { coverageWeight: "desc" },
        select: { contentId: true, coverageWeight: true },
      });
      remediationLessonIds = Array.from(
        new Set(
          mappings
            .map((m) => m.contentId)
            .filter((id) => !completedLessonIds.has(id)),
        ),
      ).slice(0, REMEDIATION_LIMIT);
    }

    const body =
      template?.body ??
      "Câu này bạn chưa đúng. Hãy đọc lại nội dung liên quan và thử lại.";

    const delivery = await db.feedbackDelivery.create({
      data: {
        userId,
        attemptId,
        questionId: r.questionId,
        templateId: template?.id ?? null,
        body,
        remediationLessonIds: remediationLessonIds as Prisma.InputJsonValue,
      },
    });

    await db.learningEvent.create({
      data: {
        userId,
        courseId,
        eventType: LearningEventType.FeedbackDelivered,
        payload: {
          deliveryId: delivery.id,
          attemptId,
          questionId: r.questionId,
          misconceptionCode,
          remediationLessonIds,
        } as Prisma.InputJsonValue,
      },
    });

    deliveries.push({
      questionId: r.questionId,
      templateId: template?.id ?? null,
      body,
      remediationLessonIds,
      misconceptionCode,
    });
  }

  return { deliveries };
}

/** Read-side helper: fetch the latest delivery per question for an attempt. */
export async function getDeliveriesForAttempt(
  userId: string,
  attemptId: string,
  db: PrismaClient = prisma,
) {
  return db.feedbackDelivery.findMany({
    where: { userId, attemptId },
    orderBy: { deliveredAt: "desc" },
  });
}
