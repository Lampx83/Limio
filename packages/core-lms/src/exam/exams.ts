import { z } from "zod";
import { ExamStatus, prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { assertCanEditCourse } from "../courses/authz";
import { emitEvent } from "../learning/events";
import { ensureDefaultSession } from "./exam-rooms";
import { ExamError } from "./types";
import { WizardConfigShape, type WizardConfigT, assembleWizardPool } from "./wizard";

const examAttemptPolicy = z.enum(["single", "multi"]);
const examGradingMode = z.enum(["auto", "manual", "hybrid"]);
const examProctoringLevel = z.enum(["none", "basic", "strict"]);

export const CreateExamInput = z
  .object({
    title: z.string().min(1).max(200).trim(),
    // A6.6 (UI) — với kind=oral, đây CŨNG là nội dung hiện ở panel phòng vấn
    // đáp (richtext, có thể chèn ảnh) — cần trần cao hơn mô tả thuần chữ.
    description: z.string().max(20_000).optional(),
    durationMin: z.number().int().positive().max(24 * 60),
    // DI SẢN — không còn được dùng để chặn ai (ca thi là tầng duy nhất quyết
    // định giờ mở/đóng). Giữ lại vì cột còn NOT NULL trong DB; sẽ xoá ở đợt
    // migration riêng. Bỏ trống thì điền khung rất rộng.
    openAt: z.coerce.date().optional(),
    closeAt: z.coerce.date().optional(),
    attemptPolicy: examAttemptPolicy.optional(),
    gradingMode: examGradingMode.optional(),
    proctoringLevel: examProctoringLevel.optional(),
    shuffleQuestions: z.boolean().optional(),
    shuffleOptions: z.boolean().optional(),
    showResultsAfterSubmit: z.boolean().optional(),
    purpose: z.enum(["assessment", "field_test"]).optional(),
    // A6.1 — Vấn đáp AI. Bất biến sau khi tạo — đổi kind = tạo Exam mới.
    kind: z.enum(["written", "oral"]).optional(),
    // A6.6 — chỉ có ý nghĩa khi kind=oral.
    answerMode: z.enum(["text", "voice"]).optional(),
  })
  .refine((d) => !d.openAt || !d.closeAt || d.openAt < d.closeAt, {
    message: "openAt must be before closeAt",
    path: ["closeAt"],
  });

/** Fields editable in any status (metadata + closeAt extension only after publish). */
export const UpdateExamInput = z
  .object({
    title: z.string().min(1).max(200).trim().optional(),
    description: z.string().max(20_000).optional(),
    durationMin: z.number().int().positive().max(24 * 60).optional(),
    openAt: z.coerce.date().optional(),
    closeAt: z.coerce.date().optional(),
    attemptPolicy: examAttemptPolicy.optional(),
    gradingMode: examGradingMode.optional(),
    proctoringLevel: examProctoringLevel.optional(),
    shuffleQuestions: z.boolean().optional(),
    shuffleOptions: z.boolean().optional(),
    showResultsAfterSubmit: z.boolean().optional(),
    purpose: z.enum(["assessment", "field_test"]).optional(),
  });

/** A7.1.1 — Create exam in DRAFT status. */
export async function createExam(
  actorUserId: string,
  courseId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ examId: string }> {
  await assertCanEditCourse(actorUserId, courseId, db);
  const parsed = CreateExamInput.safeParse(rawInput);
  if (!parsed.success) {
    throw new ExamError("validation_failed", parsed.error.flatten());
  }
  const d = parsed.data;
  const exam = await db.exam.create({
    data: {
      courseId,
      title: d.title,
      description: d.description ?? null,
      durationMin: d.durationMin,
      // Khung rộng khi không truyền: cột còn NOT NULL nhưng giá trị đã vô nghĩa.
      openAt: d.openAt ?? new Date(),
      closeAt: d.closeAt ?? new Date(Date.now() + 365 * 24 * 60 * 60_000),
      attemptPolicy: d.attemptPolicy ?? "single",
      gradingMode: d.gradingMode ?? "hybrid",
      proctoringLevel: d.proctoringLevel ?? "none",
      shuffleQuestions: d.shuffleQuestions ?? true,
      shuffleOptions: d.shuffleOptions ?? true,
      // Đề thử nghiệm mặc định KHÔNG hiện đáp án: hiện là đốt câu hỏi, lớp sau
      // không thử nghiệm sạch được nữa. GV vẫn bật lại được nếu cố ý.
      showResultsAfterSubmit:
        d.showResultsAfterSubmit ?? (d.purpose === "field_test" ? false : true),
      purpose: d.purpose ?? "assessment",
      kind: d.kind ?? "written",
      answerMode: d.answerMode ?? "text",
    },
    select: { id: true },
  });
  await emitEvent(
    actorUserId,
    LearningEventType.ExamCreated,
    { examId: exam.id, courseId },
    { courseId, eventKey: `exam.created:${exam.id}` },
    db,
  );
  return { examId: exam.id };
}

/**
 * A5.5 — Wizard input schema: exam metadata merged with wizard config.
 * `wizardConfig` is the 3-step payload (lessonIds, bloomMix, …).
 * Metadata fields have wizard-friendly defaults so the UI only needs to
 * collect title + schedule; the rest can be overridden in the full editor.
 */
export const CreateExamFromWizardInput = z.object({
  // Exam metadata (same shape as CreateExamInput)
  title: z.string().min(1).max(200).trim(),
  durationMin: z.number().int().positive().max(24 * 60),
  openAt: z.coerce.date(),
  closeAt: z.coerce.date(),
  showResultsAfterSubmit: z.boolean().optional(),
  // Wizard-specific fields (courseId comes from route param, not body)
  wizardConfig: WizardConfigShape.omit({ courseId: true }),
}).refine((d) => d.openAt < d.closeAt, {
  message: "openAt must be before closeAt",
  path: ["closeAt"],
});

/**
 * A5.5 — Create exam from wizard in DRAFT status.
 * Creates Exam + ExamWizardConfig + one ExamSection (random_from_bank,
 * per_attempt) whose poolFilter is bucket-assembled from the wizard config.
 * Also increments User.examsCreatedCount for the upgrade-banner counter.
 */
export async function createExamFromWizard(
  actorUserId: string,
  courseId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ examId: string; fallbackUsed: boolean }> {
  await assertCanEditCourse(actorUserId, courseId, db);
  const parsed = CreateExamFromWizardInput.safeParse(rawInput);
  if (!parsed.success) {
    throw new ExamError("validation_failed", parsed.error.flatten());
  }
  const { wizardConfig: wc, ...meta } = parsed.data;
  const fullConfig: WizardConfigT = { ...wc, courseId };

  const { poolFilter, fallbackUsed } = await assembleWizardPool(fullConfig, actorUserId, db);

  const exam = await db.exam.create({
    data: {
      courseId,
      createdById: actorUserId,
      title: meta.title,
      durationMin: meta.durationMin,
      openAt: meta.openAt,
      closeAt: meta.closeAt,
      // Wizard defaults: auto-grade friendly, shuffle always on.
      attemptPolicy: "single",
      gradingMode: "auto",
      proctoringLevel: "none",
      shuffleQuestions: true,
      shuffleOptions: true,
      showResultsAfterSubmit: meta.showResultsAfterSubmit ?? true,
      // 1:1 wizard config
      wizardConfig: {
        create: {
          lessonIds: fullConfig.lessonIds,
          questionCount: fullConfig.questionCount,
          bloomMix: fullConfig.bloomMix,
          difficultyProfile: fullConfig.difficultyProfile,
          distributionMode: fullConfig.distributionMode,
          sessionCount: fullConfig.sessionCount ?? null,
          autoEquating: fullConfig.autoEquating,
          createdMode: "basic",
        },
      },
      // Single random section — one pool, per-attempt sampling.
      sections: {
        create: {
          title: "Câu hỏi",
          orderIndex: 0,
          selectionMode: "random_from_bank",
          resolutionMode: "per_attempt",
          poolFilter: poolFilter as never,
        },
      },
    },
    select: { id: true },
  });

  // Increment counter for upgrade-banner (non-critical — ignore failure).
  await db.user.update({
    where: { id: actorUserId },
    data: { examsCreatedCount: { increment: 1 } },
  }).catch(() => undefined);

  await emitEvent(
    actorUserId,
    LearningEventType.ExamCreated,
    { examId: exam.id, courseId, source: "wizard" },
    { courseId, eventKey: `exam.created:${exam.id}` },
    db,
  );
  return { examId: exam.id, fallbackUsed };
}

async function loadExam(examId: string, db: PrismaClient) {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      courseId: true,
      status: true,
    },
  });
  if (!exam) throw new ExamError("exam_not_found");
  return exam;
}

/** A7.1.3 — When PUBLISHED, only metadata + closeAt are editable. */
export async function updateExam(
  actorUserId: string,
  examId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<void> {
  const exam = await loadExam(examId, db);
  await assertCanEditCourse(actorUserId, exam.courseId, db);
  const parsed = UpdateExamInput.safeParse(rawInput);
  if (!parsed.success) {
    throw new ExamError("validation_failed", parsed.error.flatten());
  }
  const data = Object.fromEntries(
    Object.entries(parsed.data).filter(([, v]) => v !== undefined),
  );
  if (Object.keys(data).length === 0) return;

  if (exam.status === "published") {
    const hasAttempts =
      (await db.examAttempt.count({ where: { examId } })) > 0;
    if (hasAttempts) {
      // Only title/description/closeAt allowed once attempts exist.
      const allowed = new Set(["title", "description", "closeAt"]);
      const rejected = Object.keys(data).filter((k) => !allowed.has(k));
      if (rejected.length > 0) {
        throw new ExamError("exam_has_attempts", { fields: rejected });
      }
    }
  }

  // Re-validate openAt < closeAt across merge of stored + patch.
  if (data.openAt || data.closeAt) {
    const current = await db.exam.findUniqueOrThrow({
      where: { id: examId },
      select: { openAt: true, closeAt: true },
    });
    const openAt = (data.openAt as Date | undefined) ?? current.openAt;
    const closeAt = (data.closeAt as Date | undefined) ?? current.closeAt;
    if (openAt >= closeAt) {
      throw new ExamError("validation_failed", "openAt must be before closeAt");
    }
  }

  await db.exam.update({ where: { id: examId }, data });
}

/** A7.1.2 — Publish-time validation. */
export async function publishExam(
  actorUserId: string,
  examId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const exam = await loadExam(examId, db);
  await assertCanEditCourse(actorUserId, exam.courseId, db);
  if (exam.status !== "draft") {
    throw new ExamError("exam_not_draft");
  }

  const full = await db.exam.findUniqueOrThrow({
    where: { id: examId },
    select: {
      id: true,
      kind: true,
      openAt: true,
      closeAt: true,
      durationMin: true,
      passages: {
        select: {
          id: true,
          _count: { select: { questions: true } },
        },
      },
      questions: {
        select: {
          id: true,
          points: true,
        },
      },
      sections: {
        select: {
          id: true,
          selectionMode: true,
          poolFilter: true,
          _count: { select: { items: true } },
        },
      },
      oralMaterials: { select: { id: true } },
    },
  });

  const errors: string[] = [];
  if (full.openAt >= full.closeAt) errors.push("openAt must be before closeAt");
  if (full.durationMin <= 0) errors.push("durationMin must be positive");

  // A6.1 — Vấn đáp AI không có passage/question/blueprint — nội dung của nó là
  // OralExamMaterial. Điều kiện publish tương đương (§"exam has no content")
  // là có ít nhất 1 tài liệu, không phải có câu hỏi.
  let randomSections: typeof full.sections = [];
  let totalPoints = 0;
  if (full.kind === "oral") {
    if (full.oralMaterials.length === 0) {
      errors.push("oral exam has no material");
    }
  } else {
    // Section random_from_bank (blueprint hoặc instructor add tay) cũng là content
    // hợp lệ — không cần passage hay standalone question đi kèm.
    randomSections = full.sections.filter((s) => s.selectionMode === "random_from_bank");
    const hasContent =
      full.passages.length > 0 || full.questions.length > 0 || randomSections.length > 0;
    if (!hasContent) {
      errors.push("exam has no passages, standalone questions, or random sections");
    }
    for (const p of full.passages) {
      if (p._count.questions === 0) {
        errors.push(`passage ${p.id} has no questions`);
      }
    }
    // Validate random_from_bank section có pool count > 0
    for (const s of randomSections) {
      const pf = s.poolFilter as { count?: number; pointsPerItem?: number } | null;
      if (!pf || typeof pf.count !== "number" || pf.count <= 0) {
        errors.push(`section ${s.id} có poolFilter rỗng hoặc count <= 0`);
      }
    }
    // totalPoints = standalone questions + ước lượng random sections (count × pointsPerItem || 1)
    const standalonePoints = full.questions.reduce((sum, q) => sum + q.points, 0);
    const randomPoints = randomSections.reduce((sum, s) => {
      const pf = s.poolFilter as { count?: number; pointsPerItem?: number } | null;
      const c = pf?.count ?? 0;
      const pp = pf?.pointsPerItem ?? 1;
      return sum + c * pp;
    }, 0);
    totalPoints = standalonePoints + randomPoints;
    if (totalPoints <= 0) errors.push("total points must be > 0");
  }

  if (errors.length > 0) {
    throw new ExamError("exam_not_publishable", { errors });
  }

  await db.exam.update({
    where: { id: examId },
    data: { status: ExamStatus.published, publishedAt: new Date() },
  });

  // Ca thi là tầng DUY NHẤT quyết định giờ mở/đóng, nên đề publish mà không có
  // ca nào thì không ai vào được. Dựng sẵn một ca mặc định lấy khung giờ của
  // đề làm giá trị khởi tạo — giáo viên không phải học khái niệm "ca thi", còn
  // khung giờ của đề trở thành hạt giống cho ca đầu tiên thay vì một cổng chặn
  // sống song song.
  await ensureDefaultSession(examId, db);

  await emitEvent(
    actorUserId,
    LearningEventType.ExamPublished,
    {
      examId,
      courseId: exam.courseId,
      questionCount: full.questions.length,
      totalPoints,
    },
    { courseId: exam.courseId, eventKey: `exam.published:${examId}` },
    db,
  );
}

export async function getExam(
  actorUserId: string,
  examId: string,
  db: PrismaClient = prisma,
): Promise<ExamWithRelations> {
  const exam = await loadExam(examId, db);
  await assertCanEditCourse(actorUserId, exam.courseId, db);
  return db.exam.findUniqueOrThrow({
    where: { id: examId },
    include: {
      passages: {
        orderBy: { orderIndex: "asc" },
        include: { skillTags: true },
      },
      questions: {
        orderBy: [{ orderInExam: "asc" }],
        include: {
          skillTags: true,
          // Join về bank để hiển thị `code` gốc (vd KNM-0042) ở tab Nội dung.
          // 1:1 FK trên unique index → cost ~negligible. Null nếu câu được tạo
          // tay (không phải copy từ bank).
          fromBank: {
            select: {
              bankQuestion: { select: { code: true, bankId: true } },
            },
          },
        },
      },
    },
  });
}

type ExamWithRelations = Awaited<ReturnType<PrismaClient["exam"]["findUniqueOrThrow"]>> & {
  passages: Array<
    Awaited<ReturnType<PrismaClient["examPassage"]["findUniqueOrThrow"]>> & {
      skillTags: Awaited<ReturnType<PrismaClient["examPassageSkillTag"]["findMany"]>>;
    }
  >;
  questions: Array<
    Awaited<ReturnType<PrismaClient["examQuestion"]["findUniqueOrThrow"]>> & {
      skillTags: Awaited<ReturnType<PrismaClient["examQuestionSkillTag"]["findMany"]>>;
      fromBank: {
        bankQuestion: { code: string | null; bankId: string };
      } | null;
    }
  >;
};

export async function listExamsForCourse(
  actorUserId: string,
  courseId: string,
  db: PrismaClient = prisma,
) {
  await assertCanEditCourse(actorUserId, courseId, db);
  return db.exam.findMany({
    where: { courseId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      durationMin: true,
      openAt: true,
      closeAt: true,
      publishedAt: true,
      createdAt: true,
    },
  });
}

export async function deleteExam(
  actorUserId: string,
  examId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const exam = await loadExam(examId, db);
  await assertCanEditCourse(actorUserId, exam.courseId, db);
  if (exam.status === "published") {
    const hasAttempts =
      (await db.examAttempt.count({ where: { examId } })) > 0;
    if (hasAttempts) throw new ExamError("exam_has_attempts");
  }
  await db.exam.delete({ where: { id: examId } });
}
