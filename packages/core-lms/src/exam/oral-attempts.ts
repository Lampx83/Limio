import { randomUUID } from "node:crypto";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { emitEvent } from "../learning/events";
import { assertCanEditExam } from "../courses/authz";
import { assertEligibleForExam } from "./cohorts";
import { ensureDefaultRound } from "./exam-rooms";
import { publishExam } from "./exams";
import { isSessionOpen } from "./session-window";
import { ExamError } from "./types";

// Alphabet không có ký tự dễ nhầm (0/O, 1/I/l) — cùng tiêu chí với code-access.ts
// nhưng viết riêng, không import từ đó: mã tham gia vấn đáp là một khái niệm
// khác (SV đăng nhập, bỏ qua Enrollment) với mã dự thi ẩn danh của thi viết,
// nên không có lý do gì để hai đường này dùng chung hàm sinh mã.
const JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateOralJoinCode(): string {
  const buf = new Uint8Array(6);
  crypto.getRandomValues(buf);
  let s = "";
  for (const b of buf) s += JOIN_CODE_ALPHABET[b % JOIN_CODE_ALPHABET.length];
  return s;
}

type StartDecision = "resume" | "create" | "already_submitted" | "limit_reached";

/**
 * Quyết định thuần (không đụng DB) khi SV bấm vào 1 đề vấn đáp, để logic "thi nhiều lượt" test được riêng:
 * - đang có lượt làm dở → tiếp tục (luôn, kể cả hết lượt);
 * - chưa có lượt nào → tạo lượt đầu (vào thẳng, như cũ);
 * - đã có lượt xong: single → chặn; multi → hết lượt thì chặn, còn lượt thì CHỈ tạo mới khi SV chủ động
 *   bấm "Thi lại" (retake). Không tự tạo khi chỉ mở lại link/refresh, để không đốt lượt ngoài ý muốn.
 */
export function decideOralStart(
  attempts: ReadonlyArray<{ status: string }>,
  policy: "single" | "multi",
  maxAttempts: number,
  retake: boolean,
): StartDecision {
  if (attempts.some((a) => a.status === "in_progress")) return "resume";
  if (attempts.length === 0) return "create";
  if (policy !== "multi") return "already_submitted";
  if (attempts.length >= maxAttempts) return "limit_reached";
  return retake ? "create" : "already_submitted";
}

/** Số lượt còn lại của 1 SV với 1 đề vấn đáp — dùng cho nút "Thi lại" và dòng "Lượt x/y". */
export async function getOralAttemptQuota(
  userId: string,
  examId: string,
  db: PrismaClient = prisma,
): Promise<{
  policy: "single" | "multi";
  max: number;
  used: number;
  remaining: number;
  canRetake: boolean;
  latestAttemptId: string | null;
}> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { attemptPolicy: true, maxAttempts: true },
  });
  if (!exam) throw new ExamError("exam_not_found");
  const attempts = await db.examAttempt.findMany({
    where: { examId, userId },
    orderBy: { startedAt: "desc" },
    select: { id: true, status: true },
  });
  const max = exam.attemptPolicy === "multi" ? exam.maxAttempts : 1;
  const used = attempts.length;
  const inProgress = attempts.some((a) => a.status === "in_progress");
  return {
    policy: exam.attemptPolicy,
    max,
    used,
    remaining: Math.max(0, max - used),
    canRetake: exam.attemptPolicy === "multi" && used > 0 && used < max && !inProgress,
    latestAttemptId: attempts[0]?.id ?? null,
  };
}

/**
 * A6.3 — Bắt đầu (hoặc resume) 1 lượt vấn đáp AI. Dùng lại nguyên
 * `assertEligibleForExam` (status/ca thi/cohort/enrollment — không quan tâm
 * loại câu hỏi) và bảng `ExamAttempt` sẵn có, nhưng KHÔNG gọi
 * buildShuffleSnapshot/materializeRandomSections như startExamAttempt: vấn
 * đáp không có ExamQuestion để xáo hay lấy pool.
 *
 * Yêu cầu SV đã đăng nhập + đã ghi danh khoá học (qua assertEligibleForExam).
 * SV vào bằng mã tham gia thay vì trang khoá học thì đi qua
 * `joinOralSessionByCode` bên dưới — không cần ghi danh, nhưng vẫn ghi vào
 * cùng bảng ExamAttempt khoá theo (examId, userId) nên không tạo lượt trùng.
 */
export async function startOralExamAttempt(
  userId: string,
  examId: string,
  opts: { retake?: boolean } = {},
  db: PrismaClient = prisma,
): Promise<{ attemptId: string; durationSec: number; resumed: boolean }> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { id: true, courseId: true, kind: true, attemptPolicy: true, maxAttempts: true },
  });
  if (!exam) throw new ExamError("exam_not_found");
  if (exam.kind !== "oral") throw new ExamError("exam_not_oral");

  const eligibility = await assertEligibleForExam(userId, examId, db);

  const attempts = await db.examAttempt.findMany({
    where: { examId, userId },
    orderBy: { startedAt: "desc" },
    select: { id: true, status: true, durationSec: true },
  });
  const decision = decideOralStart(attempts, exam.attemptPolicy, exam.maxAttempts, !!opts.retake);
  if (decision === "resume") {
    const inProgress = attempts.find((a) => a.status === "in_progress")!;
    return { attemptId: inProgress.id, durationSec: inProgress.durationSec, resumed: true };
  }
  if (decision === "limit_reached") throw new ExamError("attempt_limit_reached");
  if (decision === "already_submitted") throw new ExamError("attempt_already_submitted");

  const attemptId = randomUUID();
  const durationSec = eligibility.durationSec;
  await db.examAttempt.create({
    data: {
      id: attemptId,
      examId,
      userId,
      durationSec,
      sessionToken: randomUUID(),
      sessionId: eligibility.scheduleId,
    },
  });
  await emitEvent(
    userId,
    LearningEventType.ExamStarted,
    { examId, attemptId, durationSec },
    { courseId: exam.courseId, eventKey: `exam.started:${attemptId}` },
    db,
  );
  return { attemptId, durationSec, resumed: false };
}

/**
 * A6.5 (rewrite) — "Mở buổi vấn đáp": publish đề (nếu còn nháp) + đảm bảo có
 * một ca thi đang mở cho cả khoá học.
 *
 * Vấn đáp KHÔNG có khái niệm mã dự thi/QR/phòng — thí sinh luôn là học viên
 * đã đăng nhập + đã ghi danh (xem startOralExamAttempt, assertEligibleForExam).
 * Vì vậy hàm này KHÔNG dùng lại quick-share.ts (sinh openCode, dựng phòng mặc
 * định) — bộ máy đó phục vụ đúng bài toán "phát mã cho thí sinh ngoài hệ
 * thống" của thi viết, không áp dụng ở đây và chỉ làm rối thêm nếu tái dùng.
 * Publish đi qua `publishExam` sẵn có (đã validate "có tài liệu" cho kind
 * oral) thay vì tự lặp lại kiểm tra đó.
 *
 * ĐÚNG MỘT ca chi phối tính "đang mở" của một đề vấn đáp — không như thi viết
 * (nhiều ca song song, mỗi ca một mã). publishExam tự dựng sẵn một ca mặc
 * định qua ensureDefaultSession (khung giờ tĩnh lấy từ openAt/closeAt của
 * đề); hàm này lấy CHÍNH ca đó (ca cũ nhất của đề — luôn chỉ có một, trừ khi
 * đề từng đi qua đường phát mã cũ trước bản rewrite) và chuyển nó sang chế độ
 * thủ công, mở ngay — để nút Mở/Đóng trên trang quản lý đề có tác dụng tức
 * thời mà không phải sửa openAt/closeAt của đề, và để "Đóng buổi" chặn được
 * thật (không còn ca thứ hai nào âm thầm vẫn mở). Idempotent: gọi lại khi ca
 * đã ở đúng trạng thái mở-thủ-công thì không ghi gì thêm.
 *
 * Kèm theo một `oralJoinCode` ổn định — SV đăng nhập gõ mã này (xem
 * joinOralSessionByCode) để vào thẳng, bỏ qua Enrollment. Mã được GIỮ NGUYÊN
 * qua các lần đóng/mở lại, giống cách thi viết giữ nguyên mã dưới chân thí
 * sinh đang chờ — chỉ sinh mã MỚI khi ca chưa từng có mã.
 */
export async function openOralExamSession(
  actorUserId: string,
  examId: string,
  opts: { durationOverrideMin?: number | null } = {},
  db: PrismaClient = prisma,
): Promise<{ sessionId: string; joinCode: string; published: boolean; reused: boolean }> {
  if (
    opts.durationOverrideMin != null &&
    (!Number.isInteger(opts.durationOverrideMin) ||
      opts.durationOverrideMin <= 0 ||
      opts.durationOverrideMin > 24 * 60)
  ) {
    throw new ExamError("validation_failed", { reason: "durationOverrideMin_invalid" });
  }
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { id: true, courseId: true, createdById: true, status: true, kind: true },
  });
  if (!exam) throw new ExamError("exam_not_found");
  await assertCanEditExam(actorUserId, exam, db);
  if (exam.kind !== "oral") throw new ExamError("exam_not_oral");

  const wasDraft = exam.status === "draft";
  if (wasDraft) {
    // Ném exam_not_publishable (kèm details.errors) nếu chưa có tài liệu —
    // không lặp lại kiểm tra này ở đây. Đồng thời đảm bảo có sẵn ≥1 ca
    // (ensureDefaultSession chạy bên trong publishExam).
    await publishExam(actorUserId, examId, db);
  } else if (exam.status === "archived") {
    throw new ExamError("exam_not_draft");
  }

  const roundId = await ensureDefaultRound(examId, db);
  const existing = await db.examSession.findFirst({
    where: { examId },
    orderBy: [{ opensAt: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      timingMode: true,
      status: true,
      oralJoinCode: true,
      durationOverrideMin: true,
    },
  });

  if (!existing) {
    for (let i = 0; i < 5; i++) {
      const joinCode = generateOralJoinCode();
      try {
        const s = await db.examSession.create({
          data: {
            examId,
            roundId,
            accessMode: "authenticated",
            timingMode: "manual",
            status: "open",
            opensAt: new Date(),
            closesAt: null,
            scale: "simple",
            oralJoinCode: joinCode,
            durationOverrideMin: opts.durationOverrideMin ?? null,
          },
          select: { id: true },
        });
        return { sessionId: s.id, joinCode, published: wasDraft, reused: false };
      } catch (e) {
        if ((e as { code?: string }).code !== "P2002") throw e;
        // đụng mã — thử mã khác
      }
    }
    throw new ExamError("validation_failed", { reason: "joinCode_collision" });
  }

  const alreadyOpen = existing.timingMode === "manual" && existing.status === "open";
  let joinCode = existing.oralJoinCode;
  if (!joinCode) {
    for (let i = 0; i < 5; i++) {
      const candidate = generateOralJoinCode();
      const clash = await db.examSession.findUnique({
        where: { oralJoinCode: candidate },
        select: { id: true },
      });
      if (!clash) {
        joinCode = candidate;
        break;
      }
    }
    if (!joinCode) throw new ExamError("validation_failed", { reason: "joinCode_collision" });
  }
  const needsFieldUpdate = !alreadyOpen || existing.oralJoinCode !== joinCode;
  // Cho sửa thời lượng ngay cả khi ca đang mở (không cần đóng/mở lại): chỉ
  // ảnh hưởng các lượt thi BẮT ĐẦU SAU thời điểm này — durationSec được
  // snapshot riêng vào từng ExamAttempt lúc bắt đầu (xem joinOralSessionByCode
  // dưới), nên SV đang thi dở không bị đổi đồng hồ giữa chừng.
  const durationChanged =
    opts.durationOverrideMin !== undefined &&
    opts.durationOverrideMin !== existing.durationOverrideMin;
  if (needsFieldUpdate || durationChanged) {
    await db.examSession.update({
      where: { id: existing.id },
      data: {
        ...(needsFieldUpdate
          ? {
              timingMode: "manual" as const,
              status: "open" as const,
              accessMode: "authenticated" as const,
              openCode: null,
              oralJoinCode: joinCode,
              opensAt: new Date(),
              closesAt: null,
            }
          : {}),
        ...(opts.durationOverrideMin !== undefined
          ? { durationOverrideMin: opts.durationOverrideMin }
          : {}),
      },
    });
  }
  return { sessionId: existing.id, joinCode, published: wasDraft, reused: alreadyOpen };
}

/** Đóng ca vấn đáp đang mở — chặn thí sinh MỚI vào; ai đang thi dở vẫn được làm hết giờ. */
export async function closeOralExamSession(
  actorUserId: string,
  examId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { courseId: true, createdById: true, kind: true },
  });
  if (!exam) throw new ExamError("exam_not_found");
  await assertCanEditExam(actorUserId, exam, db);
  if (exam.kind !== "oral") throw new ExamError("exam_not_oral");
  await db.examSession.updateMany({
    where: { examId, timingMode: "manual", status: "open" },
    data: { status: "closed", closedById: actorUserId, closedAt: new Date() },
  });
}

/** Trạng thái ca vấn đáp của đề — dùng để vẽ nút Mở/Đóng + hiện mã tham gia. */
export async function getOralSessionInfo(
  examId: string,
  db: PrismaClient = prisma,
): Promise<{ open: boolean; joinCode: string | null; durationOverrideMin: number | null }> {
  const session = await db.examSession.findFirst({
    where: { examId, timingMode: "manual", status: "open" },
    select: { oralJoinCode: true, durationOverrideMin: true },
  });
  return {
    open: session !== null,
    joinCode: session?.oralJoinCode ?? null,
    durationOverrideMin: session?.durationOverrideMin ?? null,
  };
}

/**
 * Tra mã tham gia vấn đáp, KHÔNG ghi gì — dùng để hiện màn xác nhận trước khi
 * thật sự vào thi (tên đề, khoá học, còn mở hay không).
 */
export async function resolveOralJoinCode(
  code: string,
  db: PrismaClient = prisma,
): Promise<{
  examId: string;
  examTitle: string;
  /** null khi đề không gắn khoá học (đề độc lập) — UI ẩn dòng "Khoá học". */
  courseTitle: string | null;
  courseSlug: string | null;
  isOpen: boolean;
} | null> {
  const session = await db.examSession.findUnique({
    where: { oralJoinCode: code },
    select: {
      opensAt: true,
      closesAt: true,
      timingMode: true,
      status: true,
      exam: {
        select: {
          id: true,
          title: true,
          kind: true,
          course: { select: { title: true, slug: true } },
        },
      },
    },
  });
  if (!session || session.exam.kind !== "oral") return null;
  return {
    examId: session.exam.id,
    examTitle: session.exam.title,
    courseTitle: session.exam.course?.title ?? null,
    courseSlug: session.exam.course?.slug ?? null,
    isOpen: isSessionOpen(session, new Date()),
  };
}

/**
 * A6.5 (rewrite) — SV đã ĐĂNG NHẬP vào thẳng buổi vấn đáp bằng mã tham gia,
 * KHÔNG cần đã ghi danh khoá học (bỏ qua assertEligibleForExam/isUserEnrolled
 * — hợp với lớp mời ngoài, không quản lý qua Enrollment). Vẫn dùng chung bảng
 * ExamAttempt khoá theo (examId, userId) như startOralExamAttempt, nên một
 * người chỉ có một lượt thi dù vào bằng đường nào.
 */
export async function joinOralSessionByCode(
  userId: string,
  code: string,
  opts: { retake?: boolean } = {},
  db: PrismaClient = prisma,
): Promise<{ attemptId: string; durationSec: number; resumed: boolean; examId: string }> {
  const session = await db.examSession.findUnique({
    where: { oralJoinCode: code },
    select: {
      id: true,
      durationOverrideMin: true,
      opensAt: true,
      closesAt: true,
      timingMode: true,
      status: true,
      exam: {
        select: { id: true, courseId: true, kind: true, durationMin: true, attemptPolicy: true, maxAttempts: true },
      },
    },
  });
  if (!session || session.exam.kind !== "oral") throw new ExamError("invalid_code");
  if (!isSessionOpen(session, new Date())) throw new ExamError("exam_window_closed");

  const examId = session.exam.id;
  const attempts = await db.examAttempt.findMany({
    where: { examId, userId },
    orderBy: { startedAt: "desc" },
    select: { id: true, status: true, durationSec: true },
  });
  const decision = decideOralStart(
    attempts,
    session.exam.attemptPolicy,
    session.exam.maxAttempts,
    !!opts.retake,
  );
  if (decision === "resume") {
    const inProgress = attempts.find((a) => a.status === "in_progress")!;
    return { attemptId: inProgress.id, durationSec: inProgress.durationSec, resumed: true, examId };
  }
  if (decision === "limit_reached") throw new ExamError("attempt_limit_reached");
  if (decision === "already_submitted") throw new ExamError("attempt_already_submitted");

  const attemptId = randomUUID();
  const durationSec = (session.durationOverrideMin ?? session.exam.durationMin) * 60;
  await db.examAttempt.create({
    data: {
      id: attemptId,
      examId,
      userId,
      durationSec,
      sessionToken: randomUUID(),
      sessionId: session.id,
    },
  });
  await emitEvent(
    userId,
    LearningEventType.ExamStarted,
    { examId, attemptId, durationSec },
    { courseId: session.exam.courseId, eventKey: `exam.started:${attemptId}` },
    db,
  );
  return { attemptId, durationSec, resumed: false, examId };
}

/**
 * Xoá hẳn một lượt vấn đáp (dọn dữ liệu test, hoặc mở lại lượt cho SV làm
 * lại khi attemptPolicy=single đã chặn). Cascade sẵn trong schema xoá theo
 * cả OralExamTurn + OralExamEvaluation — không mồ côi dữ liệu con.
 */
export async function deleteOralAttempt(
  actorUserId: string,
  attemptId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const attempt = await db.examAttempt.findUnique({
    where: { id: attemptId },
    select: { exam: { select: { courseId: true, createdById: true, kind: true } } },
  });
  if (!attempt) throw new ExamError("attempt_not_found");
  if (attempt.exam.kind !== "oral") throw new ExamError("exam_not_oral");
  await assertCanEditExam(actorUserId, attempt.exam, db);
  await db.examAttempt.delete({ where: { id: attemptId } });
}
