import { z } from "zod";
import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { isUserEnrolled } from "../learning/enroll";
import { emitEvent } from "../learning/events";
import { gradeAnswer } from "./grading";
import { QuizError } from "./types";
import { assertCanEditCourse, assertCanGradeCourse, canEditCourse } from "../courses/authz";

/**
 * Deterministic Fisher-Yates shuffle for ordering question options. Uses a
 * tiny string-seeded PRNG (mulberry32-style) so the same (attemptId, questionId)
 * pair always yields the same permutation — learner reload doesn't see
 * options jump around. New attempt = new attemptId = new shuffle.
 *
 * NOT a CSPRNG. Sufficient for "scramble visible order so the correct answer
 * isn't given away" — instructor's UI still grades against the canonical
 * orderIndex sequence (stored option.orderIndex doesn't change).
 */
function seededShuffleOrdering<T>(arr: readonly T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const next = () => {
    h |= 0;
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

// Response shapes per question type:
//   mcq/true_false/ordering: string[] (option IDs)
//   fill_in/short_answer/essay: string
//   numerical: number
//   matching: Array<{ leftId: string, rightId: string }>
const MatchPair = z.object({
  leftId: z.string(),
  rightId: z.string(),
});

/**
 * Trần cho thời gian một câu: hai tiếng. Quá mốc này thì gần như chắc chắn
 * người học để tab đó rồi đi làm việc khác — con số không còn nói lên độ khó
 * của câu hỏi nữa, và giữ lại chỉ làm lệch mọi giá trị trung bình.
 */
export const MAX_LATENCY_MS = 2 * 60 * 60 * 1000;

/**
 * Khoảng ân hạn sau khi hết giờ mà máy chủ vẫn nhận đáp án, tính bằng giây.
 * Đủ để một lượt nộp gồm hàng chục lời gọi mạng đi hết, không đủ để làm thêm.
 */
export const LATE_ANSWER_GRACE_SEC = 60;

export const SubmitAnswerInput = z.object({
  questionId: z.string().uuid(),
  response: z.union([
    z.array(z.string()),
    z.string(),
    z.number(),
    z.array(MatchPair),
  ]),
  confidence: z.number().int().min(1).max(5).optional(),
  /**
   * B12 — số mili-giây từ lúc câu hỏi hiện ra tới lúc người học chọn xong. Chỉ
   * máy khách biết câu nào đang hiện nên phải do máy khách đo và gửi lên.
   *
   * Máy khách cũ không gửi trường này; khi đó `latencyMs` để trống chứ không
   * lấy tạm `responseTimeMs`, vì hai đại lượng đó khác nhau và trộn vào nhau
   * là làm hỏng chính con số ta định dùng để đo độ khó.
   */
  latencyMs: z.number().int().min(0).max(MAX_LATENCY_MS).optional(),
});

interface QuizForAttempt {
  id: string;
  courseId: string | null;
  maxAttempts: number | null;
  timeLimitSec: number | null;
  passThresholdPct: number;
  requireConfidence: boolean;
}

async function loadQuiz(quizId: string, db: PrismaClient): Promise<QuizForAttempt> {
  const q = await db.quiz.findUnique({
    where: { id: quizId },
    select: {
      id: true,
      courseId: true,
      maxAttempts: true,
      timeLimitSec: true,
      passThresholdPct: true,
      requireConfidence: true,
    },
  });
  if (!q) throw new QuizError("quiz_not_found");
  return q;
}

/** Idempotent on `in_progress`: starting again returns the existing attempt. */
export async function startAttempt(
  userId: string,
  quizId: string,
  db: PrismaClient = prisma,
): Promise<{ attemptId: string; created: boolean }> {
  const quiz = await loadQuiz(quizId, db);
  if (!quiz.courseId) throw new QuizError("quiz_not_found");
  if (!(await isUserEnrolled(userId, quiz.courseId, db))) {
    // Allow course instructors/admins to start an attempt for preview purposes.
    if (!(await canEditCourse(userId, quiz.courseId, db))) {
      throw new QuizError("not_enrolled");
    }
  }

  // Reuse existing in_progress attempt.
  const existing = await db.quizAttempt.findFirst({
    where: { userId, quizId, status: "in_progress" },
  });
  if (existing) return { attemptId: existing.id, created: false };

  // Enforce max_attempts (counting submitted+abandoned).
  if (quiz.maxAttempts !== null) {
    const usedCount = await db.quizAttempt.count({
      where: { userId, quizId, status: { in: ["submitted", "abandoned"] } },
    });
    if (usedCount >= quiz.maxAttempts) {
      throw new QuizError("max_attempts_exceeded");
    }
  }

  // Reject quiz with zero questions.
  const questionCount = await db.quizQuestion.count({ where: { quizId } });
  if (questionCount === 0) throw new QuizError("no_questions");

  const attempt = await db.quizAttempt.create({
    data: { userId, quizId, status: "in_progress" },
  });
  await emitEvent(
    userId,
    LearningEventType.QuizStarted,
    { quizId, attemptId: attempt.id },
    { courseId: quiz.courseId, eventKey: `quiz.started:${attempt.id}` },
    db,
  );
  return { attemptId: attempt.id, created: true };
}

async function loadAttemptOwned(
  userId: string,
  attemptId: string,
  db: PrismaClient,
) {
  const attempt = await db.quizAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt) throw new QuizError("attempt_not_found");
  if (attempt.userId !== userId) throw new QuizError("attempt_belongs_to_other");
  return attempt;
}

export async function submitAnswer(
  userId: string,
  attemptId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<void> {
  const attempt = await loadAttemptOwned(userId, attemptId, db);
  if (attempt.status !== "in_progress") {
    throw new QuizError("attempt_already_submitted");
  }
  const quiz = await loadQuiz(attempt.quizId, db);

  const parsed = SubmitAnswerInput.safeParse(rawInput);
  if (!parsed.success) throw new QuizError("validation_failed", parsed.error.flatten());

  if (quiz.requireConfidence && parsed.data.confidence === undefined) {
    throw new QuizError("validation_failed", "confidence_required");
  }

  // Verify question belongs to this quiz.
  const question = await db.quizQuestion.findUnique({
    where: { id: parsed.data.questionId },
    select: { quizId: true },
  });
  if (!question || question.quizId !== quiz.id) {
    throw new QuizError("validation_failed", "question_not_in_quiz");
  }

  const answeredAt = new Date();

  // Quá giờ thì không nhận đáp án nữa. Máy khách đã tự nộp lúc đồng hồ về 0,
  // nhưng đó chỉ là phép lịch sự — ai tắt JavaScript hoặc gọi thẳng API vẫn
  // trả lời được cả tiếng sau, và điểm vẫn tính.
  //
  // Có khoảng ân hạn vì mọi đáp án chỉ được gửi lên MỘT LƯỢT lúc bấm nộp: một
  // người làm xong đúng giờ nhưng bấm nộp ở giây thứ 601 sẽ mất sạch bài nếu
  // chặn cứng ở đúng mốc.
  if (quiz.timeLimitSec !== null) {
    const elapsed = (answeredAt.getTime() - attempt.startedAt.getTime()) / 1000;
    if (elapsed > quiz.timeLimitSec + LATE_ANSWER_GRACE_SEC) {
      throw new QuizError("time_expired");
    }
  }

  // Giữ tên cũ và nghĩa cũ: số mili-giây tính từ lúc bắt đầu cả lượt làm bài.
  // Dữ liệu cũ đã ghi theo nghĩa này, đổi nghĩa của một cột đang có là làm
  // hỏng dữ liệu cũ một cách lặng lẽ. Thời gian thật của từng câu nằm ở
  // `latencyMs` — cột mới, nullable.
  const responseTimeMs = answeredAt.getTime() - attempt.startedAt.getTime();

  // Thời gian riêng một câu không thể dài hơn cả lượt làm bài. Khai dài hơn
  // nghĩa là máy khách tính sai hoặc cố tình — bỏ hẳn số đó thay vì kẹp về mức
  // hợp lệ. Kẹp lại sẽ biến một lỗi thành con số trông rất bình thường, và một
  // con số trông bình thường thì không ai kiểm tra nữa. `latencyMs` là một
  // khoảng thời gian do máy khách tự đo, không phải mốc thời gian, nên lệch
  // đồng hồ giữa hai máy không phải lý do biện minh cho chuyện này.
  const latencyMs =
    parsed.data.latencyMs === undefined || parsed.data.latencyMs > responseTimeMs
      ? null
      : parsed.data.latencyMs;

  const prior = await db.answerResponse.findUnique({
    where: { attemptId_questionId: { attemptId, questionId: parsed.data.questionId } },
    select: { revisionCount: true },
  });

  // Grade now (so isCorrect is stored), but final score computed at submit-time.
  const fullQuestion = await db.quizQuestion.findUniqueOrThrow({
    where: { id: parsed.data.questionId },
    include: { options: { include: { misconception: true } } },
  });
  const evalResult = gradeAnswer(fullQuestion, parsed.data.response);

  await db.answerResponse.upsert({
    where: { attemptId_questionId: { attemptId, questionId: parsed.data.questionId } },
    create: {
      attemptId,
      questionId: parsed.data.questionId,
      response: parsed.data.response as Prisma.InputJsonValue,
      isCorrect: evalResult.isCorrect,
      needsGrading: evalResult.needsGrading ?? false,
      confidence: parsed.data.confidence ?? null,
      responseTimeMs,
      latencyMs,
      revisionCount: 0,
      answeredAt,
    },
    update: {
      response: parsed.data.response as Prisma.InputJsonValue,
      isCorrect: evalResult.isCorrect,
      needsGrading: evalResult.needsGrading ?? false,
      manualScore: null,
      confidence: parsed.data.confidence ?? null,
      responseTimeMs,
      latencyMs,
      // Sửa lại đáp án là một tín hiệu khác hẳn trả lời một phát ăn ngay,
      // nhất là khi ghép với độ tự tin. Đếm lần sửa vì bản thân đáp án cũ bị
      // ghi đè — không đếm ở đây thì không còn dấu vết nào.
      revisionCount: (prior?.revisionCount ?? 0) + 1,
      answeredAt,
    },
  });

  await emitEvent(
    userId,
    LearningEventType.QuizQuestionAnswered,
    {
      quizId: quiz.id,
      attemptId,
      questionId: parsed.data.questionId,
      isCorrect: evalResult.isCorrect,
      confidence: parsed.data.confidence,
      responseTimeMs,
      latencyMs,
      revisionCount: (prior?.revisionCount ?? 0) + (prior ? 1 : 0),
    },
    { courseId: quiz.courseId ?? undefined },
    db,
  );
}

export interface SubmitResult {
  attemptId: string;
  quizId: string;
  /** Courses this quiz lives under — null only if quiz somehow had no courseId (legacy data). */
  courseId: string | null;
  scorePct: number;
  passed: boolean;
  expired: boolean;
  /** Seconds spent on this attempt (submitted - started). */
  elapsedSec: number;
  /** Quiz difficulty 1-5, or null if instructor didn't set it. */
  difficulty: number | null;
  /** True if this is the user's first ever PASSED attempt for this quiz. */
  isFirstPass: boolean;
  totalQuestions: number;
  correctCount: number;
}

/**
 * Bỏ một lượt làm đang dở.
 *
 * Dùng cho lượt đã quá giờ mà chưa trả lời câu nào — người học chỉ mở ra xem.
 * Nộp một lượt như thế sẽ ghi 0 điểm cho bài họ chưa từng làm, và con số đó
 * chui vào cả điểm số lẫn thống kê lẫn phản hồi. Bỏ đi thì họ làm lại được.
 *
 * Chỉ bỏ được lượt trống: có đáp án rồi thì đó là bài làm thật, và xoá bài làm
 * thật phải là quyết định của người dạy chứ không phải của một hàm dọn dẹp.
 */
export async function abandonAttempt(
  userId: string,
  attemptId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const attempt = await loadAttemptOwned(userId, attemptId, db);
  if (attempt.status !== "in_progress") return;

  const answered = await db.answerResponse.count({ where: { attemptId } });
  if (answered > 0) throw new QuizError("validation_failed", "attempt_has_answers");

  await db.quizAttempt.update({
    where: { id: attemptId },
    data: { status: "abandoned", submittedAt: new Date() },
  });
}

export async function submitAttempt(
  userId: string,
  attemptId: string,
  db: PrismaClient = prisma,
): Promise<SubmitResult> {
  const attempt = await loadAttemptOwned(userId, attemptId, db);
  if (attempt.status !== "in_progress") {
    throw new QuizError("attempt_already_submitted");
  }
  const quiz = await loadQuiz(attempt.quizId, db);

  const submittedAt = new Date();
  const elapsedSec = (submittedAt.getTime() - attempt.startedAt.getTime()) / 1000;
  const expired = quiz.timeLimitSec !== null && elapsedSec > quiz.timeLimitSec;

  // Compute score from already-graded AnswerResponse rows (set by submitAnswer).
  // Essay questions awaiting manual grading contribute 0 until instructor grades.
  const [questions, responses] = await Promise.all([
    db.quizQuestion.findMany({
      where: { quizId: quiz.id },
      select: { id: true, points: true },
    }),
    db.answerResponse.findMany({
      where: { attemptId },
      select: {
        questionId: true,
        isCorrect: true,
        needsGrading: true,
        manualScore: true,
      },
    }),
  ]);
  const totalPoints = questions.reduce((s, q) => s + q.points, 0);
  const responseMap = new Map(responses.map((r) => [r.questionId, r]));
  const earnedPoints = questions.reduce((s, q) => {
    const r = responseMap.get(q.id);
    if (!r) return s;
    if (r.needsGrading && r.manualScore === null) return s; // pending essay
    if (r.manualScore !== null) return s + Math.min(r.manualScore, q.points);
    return s + (r.isCorrect ? q.points : 0);
  }, 0);
  const scorePct =
    totalPoints === 0 ? 0 : Math.round((earnedPoints / totalPoints) * 1000) / 10; // 1 decimal
  const passed = scorePct >= quiz.passThresholdPct;

  // Detect "first pass" before persisting the new submission, so we don't
  // count this attempt itself as a prior pass.
  const priorPassedCount = passed
    ? await db.quizAttempt.count({
        where: { userId, quizId: quiz.id, status: "submitted", passed: true },
      })
    : 0;
  const isFirstPass = passed && priorPassedCount === 0;

  await db.quizAttempt.update({
    where: { id: attemptId },
    data: {
      status: "submitted",
      submittedAt,
      scorePct,
      passed,
    },
  });

  // Difficulty is on the Quiz row — fetch once for the return shape.
  const quizFull = await db.quiz.findUniqueOrThrow({
    where: { id: quiz.id },
    select: { difficulty: true },
  });

  await emitEvent(
    userId,
    LearningEventType.QuizSubmitted,
    {
      quizId: quiz.id,
      attemptId,
      scorePct,
      passed,
      expired,
      isFirstPass,
    },
    { courseId: quiz.courseId ?? undefined, eventKey: `quiz.submitted:${attemptId}` },
    db,
  );

  return {
    attemptId,
    quizId: quiz.id,
    courseId: quiz.courseId,
    scorePct,
    passed,
    expired,
    elapsedSec,
    difficulty: quizFull.difficulty,
    isFirstPass,
    totalQuestions: questions.length,
    correctCount: questions.filter((q) => responseMap.get(q.id)?.isCorrect).length,
  };
}

/** Returns the attempt with questions safe for the learner (no isCorrect / no misconception). */
export async function getAttemptForLearner(
  userId: string,
  attemptId: string,
  db: PrismaClient = prisma,
) {
  const attempt = await loadAttemptOwned(userId, attemptId, db);
  const quiz = await db.quiz.findUniqueOrThrow({
    where: { id: attempt.quizId },
    include: {
      questions: {
        orderBy: { orderIndex: "asc" },
        select: {
          id: true,
          type: true,
          prompt: true,
          points: true,
          orderIndex: true,
          // Expose `extra` (numerical needs no leak — but `expected/tolerance`
          // would let learner cheat). Strip sensitive fields here.
          extra: true,
          options: {
            orderBy: { orderIndex: "asc" },
            select: { id: true, label: true, orderIndex: true, extra: true },
          },
        },
      },
    },
  });
  // Strip numerical answer keys from `extra` before returning to learner.
  for (const q of quiz.questions) {
    if (q.type === "numerical" && q.extra) {
      const { expected: _e, tolerance: _t, ...rest } = q.extra as Record<string, unknown>;
      q.extra = Object.keys(rest).length > 0 ? (rest as typeof q.extra) : null;
    }
    if (q.type === "short_answer" && q.extra) {
      // Strip acceptedRegexes (would leak answer pattern).
      const { acceptedRegexes: _r, ...rest } = q.extra as Record<string, unknown>;
      q.extra = Object.keys(rest).length > 0 ? (rest as typeof q.extra) : null;
    }
    // Ordering: options.orderBy(orderIndex) = thứ tự đúng → trả về như vậy
    // sẽ leak đáp án (learner chỉ cần Submit không sửa). Shuffle với seed
    // deterministic (attemptId + questionId) để khi reload giữ nguyên thứ
    // tự — không bị nhảy options gây confusion.
    if (q.type === "ordering" && q.options.length > 1) {
      q.options = seededShuffleOrdering(q.options, `${attemptId}:${q.id}`);
    }
  }
  const responses = await db.answerResponse.findMany({
    where: { attemptId },
    select: { questionId: true, response: true, confidence: true },
  });
  return { attempt, quiz, responses };
}

/** Returns full graded result. Only valid for submitted attempts. */
/**
 * Phần đáp án của một câu, dùng cho màn hình kết quả.
 *
 * Trả về NHÃN của mọi phương án chứ không chỉ id: trang kết quả cần in ra
 * "bạn chọn gì / đáp án đúng là gì", mà nó không tải riêng đề bài — trước đây
 * chỉ có `correctOptionIds` nên chẳng dựng lại được chữ nào.
 *
 * `orderIndex` và `extra` phải đi kèm: `ordering` chấm theo orderIndex,
 * `matching` ghép theo `extra.pairKey`/`extra.side`, `drag_drop_fill` theo
 * `extra.blankIndex`. Thiếu chúng thì không dựng lại được đáp án đúng.
 *
 * Chỉ gọi sau khi bài đã nộp — cả hai hàm dưới đây đều chặn trạng thái khác.
 */
function optionsForReview(
  options: { id: string; label: string; isCorrect: boolean; orderIndex: number; extra: unknown }[],
) {
  return [...options]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((o) => ({
      id: o.id,
      label: o.label,
      isCorrect: o.isCorrect,
      orderIndex: o.orderIndex,
      extra: (o.extra ?? null) as Record<string, unknown> | null,
    }));
}

/**
 * Metadata của câu hỏi được phép lộ sau khi nộp: `numerical` cần expected +
 * tolerance để nói "đáp án đúng là 42 (±0.5)". Bỏ `acceptedRegexes` — mẫu
 * regex là công cụ chấm, in ra chỉ làm người học rối.
 */
function questionMetaForReview(extra: unknown) {
  const meta = (extra ?? {}) as Record<string, unknown>;
  const expected = typeof meta.expected === "number" ? meta.expected : null;
  const tolerance = typeof meta.tolerance === "number" ? meta.tolerance : null;
  return { expected, tolerance };
}

export async function getAttemptResult(
  userId: string,
  attemptId: string,
  db: PrismaClient = prisma,
) {
  const attempt = await loadAttemptOwned(userId, attemptId, db);
  if (attempt.status !== "submitted") {
    throw new QuizError("validation_failed", "attempt_not_submitted");
  }
  const [questions, responses] = await Promise.all([
    db.quizQuestion.findMany({
      where: { quizId: attempt.quizId },
      orderBy: { orderIndex: "asc" },
      include: {
        options: { include: { misconception: { select: { code: true } } } },
      },
    }),
    db.answerResponse.findMany({ where: { attemptId } }),
  ]);
  const responseMap = new Map(responses.map((r) => [r.questionId, r]));
  const items = questions.map((q) => {
    const r = responseMap.get(q.id);
    const correctOptionIds = q.options.filter((o) => o.isCorrect).map((o) => o.id);
    let misconceptionCode: string | undefined;
    if (r && !r.isCorrect) {
      const selected = Array.isArray(r.response) ? (r.response as string[]) : [];
      const wrongPicked = q.options.find(
        (o) =>
          selected.includes(o.id) && !o.isCorrect && o.misconception?.code,
      );
      if (wrongPicked?.misconception?.code) {
        misconceptionCode = wrongPicked.misconception.code;
      }
    }
    return {
      questionId: q.id,
      prompt: q.prompt,
      type: q.type,
      explanation: q.explanation,
      points: q.points,
      yourResponse: r?.response ?? null,
      isCorrect: r?.isCorrect ?? false,
      confidence: r?.confidence ?? null,
      correctOptionIds,
      options: optionsForReview(q.options),
      meta: questionMetaForReview(q.extra),
      misconceptionCode,
    };
  });

  return {
    attempt,
    items,
  };
}

/**
 * Instructor-side variant of getAttemptResult. Skips the SV ownership check
 * because the caller is the course instructor (caller must verify
 * `assertCanEditCourse` first — typically the API route does this). Returns
 * the same shape as `getAttemptResult` plus the SV's identity for the UI.
 */
export async function getAttemptResultAsInstructor(
  attemptId: string,
  db: PrismaClient = prisma,
) {
  const attempt = await db.quizAttempt.findUnique({
    where: { id: attemptId },
    include: { user: { select: { id: true, displayName: true, email: true } } },
  });
  if (!attempt) throw new QuizError("attempt_not_found");
  if (attempt.status !== "submitted") {
    throw new QuizError("validation_failed", "attempt_not_submitted");
  }
  const [questions, responses] = await Promise.all([
    db.quizQuestion.findMany({
      where: { quizId: attempt.quizId },
      orderBy: { orderIndex: "asc" },
      include: {
        options: { include: { misconception: { select: { code: true } } } },
      },
    }),
    db.answerResponse.findMany({ where: { attemptId } }),
  ]);
  const responseMap = new Map(responses.map((r) => [r.questionId, r]));
  const items = questions.map((q) => {
    const r = responseMap.get(q.id);
    const correctOptionIds = q.options
      .filter((o) => o.isCorrect)
      .map((o) => o.id);
    let misconceptionCode: string | undefined;
    if (r && !r.isCorrect) {
      const selected = Array.isArray(r.response) ? (r.response as string[]) : [];
      const wrongPicked = q.options.find(
        (o) =>
          selected.includes(o.id) && !o.isCorrect && o.misconception?.code,
      );
      if (wrongPicked?.misconception?.code) {
        misconceptionCode = wrongPicked.misconception.code;
      }
    }
    return {
      questionId: q.id,
      prompt: q.prompt,
      type: q.type,
      explanation: q.explanation,
      points: q.points,
      yourResponse: r?.response ?? null,
      isCorrect: r?.isCorrect ?? false,
      confidence: r?.confidence ?? null,
      correctOptionIds,
      options: optionsForReview(q.options),
      meta: questionMetaForReview(q.extra),
      misconceptionCode,
      // Instructor needs to know if essay/short-answer still needs grading.
      needsGrading: r?.needsGrading ?? false,
      manualScore: r?.manualScore ?? null,
    };
  });
  return {
    attempt: {
      id: attempt.id,
      status: attempt.status,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      scorePct: attempt.scorePct,
      passed: attempt.passed,
      user: attempt.user,
    },
    items,
  };
}

/**
 * Manually grade an essay/short_answer response. Instructor enters a score
 * (capped at the question's `points`); flips `needsGrading=false`,
 * `isCorrect = manualScore > 0`. Idempotent — re-grading overwrites.
 */
export async function gradeEssayResponse(
  graderUserId: string,
  responseId: string,
  rawInput: { score: number; isCorrect?: boolean },
  db: PrismaClient = prisma,
): Promise<void> {
  const r = await db.answerResponse.findUnique({
    where: { id: responseId },
    select: {
      id: true,
      attemptId: true,
      question: {
        select: {
          id: true,
          points: true,
          quiz: { select: { courseId: true } },
        },
      },
    },
  });
  if (!r) throw new QuizError("validation_failed", "response_not_found");
  if (!r.question.quiz.courseId)
    throw new QuizError("validation_failed", "no_course");
  await assertCanGradeCourse(graderUserId, r.question.quiz.courseId, db);

  const max = r.question.points;
  const score = Math.max(0, Math.min(max, Math.round(rawInput.score)));
  const isCorrect = rawInput.isCorrect ?? score > 0;
  await db.answerResponse.update({
    where: { id: r.id },
    data: {
      manualScore: score,
      isCorrect,
      needsGrading: false,
    },
  });
  // Recompute attempt scorePct + emit event for instructor audit.
  await recomputeAttemptScore(r.attemptId, db);
}

async function recomputeAttemptScore(attemptId: string, db: PrismaClient) {
  const attempt = await db.quizAttempt.findUnique({
    where: { id: attemptId },
    select: { quizId: true, status: true },
  });
  if (!attempt || attempt.status !== "submitted") return;
  const quiz = await db.quiz.findUnique({
    where: { id: attempt.quizId },
    select: { passThresholdPct: true },
  });
  if (!quiz) return;
  const [questions, responses] = await Promise.all([
    db.quizQuestion.findMany({
      where: { quizId: attempt.quizId },
      select: { id: true, points: true },
    }),
    db.answerResponse.findMany({
      where: { attemptId },
      select: {
        questionId: true,
        isCorrect: true,
        needsGrading: true,
        manualScore: true,
      },
    }),
  ]);
  const totalPoints = questions.reduce((s, q) => s + q.points, 0);
  const responseMap = new Map(responses.map((r) => [r.questionId, r]));
  const earnedPoints = questions.reduce((s, q) => {
    const r = responseMap.get(q.id);
    if (!r) return s;
    if (r.needsGrading && r.manualScore === null) return s;
    if (r.manualScore !== null) return s + Math.min(r.manualScore, q.points);
    return s + (r.isCorrect ? q.points : 0);
  }, 0);
  const scorePct =
    totalPoints === 0 ? 0 : Math.round((earnedPoints / totalPoints) * 1000) / 10;
  const passed = scorePct >= quiz.passThresholdPct;
  await db.quizAttempt.update({
    where: { id: attemptId },
    data: { scorePct, passed },
  });
}
