/**
 * A5.8 — Code-based exam access services.
 *
 * `claimByOpenCode`     — Open mode: anyone with the exam's openCode can enter.
 *                         Một MSSV = một bài trong mỗi ca: vào lại (mất cookie,
 *                         đổi máy) thì tiếp tục bài cũ chứ không tạo bài mới.
 *                         Bắt buộc: họ tên + mã sinh viên (định danh chính —
 *                         quét QR vào thi thường không có sẵn email/SĐT trong
 *                         tay). Phone/email chỉ tuỳ chọn.
 * `claimByAssignedCode` — Assigned mode: each candidate has their own code.
 *                         1 candidate × 1 exam = 1 attempt (Q5 resume).
 *
 * Both:
 *   - Validate exam.accessMode + exam window (openAt..closeAt).
 *   - Generate `sessionToken` (rotated by claimAttemptSession on tab-claim).
 *   - Emit `exam.candidate.created` / `exam.candidate.code_claimed` events.
 *
 * Caller (D4 route) wraps the result with `signExamSession` + cookie set.
 */

import { randomUUID } from "node:crypto";
import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { emitEvent } from "../learning/events";
import { buildShuffleSnapshot } from "./attempts";
import { ensureDefaultSession } from "./exam-rooms";
import { capDurationToWindow, sessionOpenState } from "./session-window";
import { ExamError } from "./types";

/**
 * Per-candidate countdown duration. The ca thi (ExamSession) may set a
 * `durationOverrideMin`; when present it wins over `Exam.durationMin` — same
 * precedence as the enrolled-user path (cohorts.ts `assertEligibleForExam`).
 * Falls back to the exam duration when no session or no override.
 */
async function resolveDurationSec(
  examDurationMin: number,
  sessionId: string | null,
  db: PrismaClient,
): Promise<number> {
  if (sessionId) {
    const session = await db.examSession.findUnique({
      where: { id: sessionId },
      select: { durationOverrideMin: true },
    });
    if (session?.durationOverrideMin) return session.durationOverrideMin * 60;
  }
  return examDurationMin * 60;
}

/** So sánh họ tên không phân biệt dấu, hoa thường và khoảng trắng thừa. */
function foldName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Alphabet without ambiguous 0/O, 1/I/l. Easier to read off a slide.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateCode(len: number): string {
  const buf = new Uint8Array(len);
  // crypto.getRandomValues works in Node ≥18 globally.
  crypto.getRandomValues(buf);
  let s = "";
  for (const b of buf) s += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return s;
}

/** Generate the shared open-mode code. */
export function generateOpenCode(): string {
  return generateCode(6);
}

/** Generate a per-candidate code for assigned mode. */
export function generateAssignedCode(): string {
  return generateCode(8);
}

/** Generate a self-enroll invite code for a CourseSection. Global-unique (caller retries on P2002). */
export function generateSectionInviteCode(): string {
  return generateCode(6);
}

export interface ClaimResult {
  candidateId: string;
  attemptId: string;
  examId: string;
  sessionToken: string;
  displayName: string;
  resumed: boolean;
  /** Seconds from now until the cookie should expire — caller passes to JWT.exp. */
  ttlSec: number;
}

interface OpenClaimInput {
  displayName: string;
  studentCode: string;
  phone?: string;
  email?: string;
  class?: string;
  // PR2.12 — Resolved cohortId từ preview step (frontend đã verify mã lớp).
  cohortId?: string;
  // Mã phòng thi 4 ký tự (tuỳ chọn). Nếu nhập đúng → candidate được tự gán
  // vào phòng đó; sai mã → throw invalid_room_code; bỏ trống → roomId=null
  // và instructor sẽ assign sau.
  roomCode?: string;
}

function normaliseName(raw: unknown): string {
  if (typeof raw !== "string") throw new ExamError("candidate_name_required");
  const n = raw.trim();
  if (n.length === 0) throw new ExamError("candidate_name_required");
  if (n.length > 200) return n.slice(0, 200);
  return n;
}

/**
 * MSSV là định danh bắt buộc thay cho email/SĐT — quét QR vào thi tại lớp,
 * học sinh luôn nhớ MSSV, không phải lúc nào cũng nhớ hay có sẵn email/SĐT.
 */
function normaliseStudentCode(raw: unknown): string {
  if (typeof raw !== "string") throw new ExamError("candidate_student_code_required");
  const s = raw.trim();
  if (s.length === 0) throw new ExamError("candidate_student_code_required");
  return s.slice(0, 50);
}

/**
 * Phone/email nay TUỲ CHỌN (xem đầu file). Bỏ trống → undefined, không chặn
 * claim. Có nhập nhưng sai định dạng → vẫn từ chối, tránh rác dữ liệu.
 */
function normalisePhone(raw: unknown): string | undefined {
  if (typeof raw !== "string" || raw.trim().length === 0) return undefined;
  // VN-friendly: digits only, 9-11 length.
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length < 9 || digits.length > 11)
    throw new ExamError("candidate_phone_required");
  return digits;
}

function normaliseEmail(raw: unknown): string | undefined {
  if (typeof raw !== "string" || raw.trim().length === 0) return undefined;
  const e = raw.trim().toLowerCase();
  // Minimal regex: local@domain.tld — full RFC is impractical at this layer.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    throw new ExamError("candidate_email_required");
  if (e.length > 200) throw new ExamError("candidate_email_required");
  return e;
}

/** Giảng viên đã cấp quyền vào lại (grantAttemptReentry) và còn hạn? */
function hasActiveReentryGrant(metadata: unknown, now: Date): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  const until = (metadata as { reentryGrantedUntil?: unknown }).reentryGrantedUntil;
  if (typeof until !== "string") return false;
  const t = new Date(until).getTime();
  return Number.isFinite(t) && t > now.getTime();
}

/**
 * Người vừa nhập có đúng là chủ của candidate đã có không?
 *
 * MSSV gần như công khai nên không đủ để chiếm lại một phiên đang làm dở. Yếu tố
 * thứ hai:
 *   - lần đầu có nhập email/SĐT → lần này phải nhập lại KHỚP một trong hai (họ tên
 *     không còn được tính: bạn cùng lớp thường biết họ tên của nhau, còn email/SĐT
 *     thì ít khi biết);
 *   - lần đầu không nhập gì → so họ tên, để không khoá người dùng ra ngoài.
 * Email so không phân biệt hoa thường; SĐT so theo chữ số.
 */
function isSameOwner(
  stored: { displayName: string; metadata: unknown },
  input: OpenClaimInput,
  now: Date,
): boolean {
  const m = (stored.metadata && typeof stored.metadata === "object"
    ? stored.metadata
    : {}) as { email?: unknown; phone?: unknown };
  if (hasActiveReentryGrant(stored.metadata, now)) return true;
  const storedEmail =
    typeof m.email === "string" && m.email.trim() ? m.email.trim().toLowerCase() : null;
  const storedPhone =
    typeof m.phone === "string" && m.phone.replace(/\D/g, "")
      ? m.phone.replace(/\D/g, "")
      : null;

  if (storedEmail || storedPhone) {
    return (
      (storedEmail !== null && input.email === storedEmail) ||
      (storedPhone !== null && input.phone === storedPhone)
    );
  }
  return foldName(stored.displayName) === foldName(input.displayName);
}

/** Ca thủ công không có giờ đóng — cookie sống 24h là đủ cho một buổi học. */
const MANUAL_SESSION_TTL_SEC = 24 * 3600;

function computeTtlSec(closeAt: Date | null): number {
  // Q6 — cookie covers active exam window + 1h grace for late submit/review.
  // Hard cap at 7 days; floor at 5 min so a near-end claim still has room.
  if (closeAt === null) return MANUAL_SESSION_TTL_SEC;
  const remaining = Math.floor((closeAt.getTime() - Date.now()) / 1000) + 3600;
  return Math.max(300, Math.min(remaining, 7 * 24 * 3600));
}

/**
 * Q1: open-mode claim. Một MSSV chỉ có MỘT bài trong mỗi ca:
 *   - chưa có → tạo candidate + attempt;
 *   - đang làm dở + đúng chủ (xem isSameOwner: email/SĐT đã nhập lần đầu, hoặc họ
 *     tên nếu lần đầu không nhập) → tiếp tục bài đó (xoay sessionToken như luồng
 *     mã được gán); sai → từ chối, vì MSSV là thông tin gần như công khai và
 *     không được dùng để chiếm phiên của người đang thi;
 *   - đã nộp → từ chối (không cho thi lại).
 */
export async function claimByOpenCode(
  code: unknown,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<ClaimResult> {
  if (typeof code !== "string" || code.trim().length === 0)
    throw new ExamError("invalid_code");
  const upperCode = code.trim().toUpperCase();

  // PR2.12 — Lookup ExamSession.openCode trước (per-session). Mỗi ca có
  // mã access riêng + mode riêng. Fallback sang Exam.openCode (legacy) nếu
  // không match session nào.
  let resolvedSessionId: string | null = null;
  const sessionMatch = await db.examSession.findFirst({
    where: { openCode: upperCode, accessMode: "open_code" },
    select: {
      id: true,
      opensAt: true,
      closesAt: true,
      timingMode: true,
      status: true,
      exam: {
        select: {
          id: true,
          accessMode: true,
          status: true,
          openAt: true,
          closeAt: true,
          durationMin: true,
          openMaxAttempts: true,
          shuffleQuestions: true,
          shuffleOptions: true,
          courseId: true,
          kind: true,
        },
      },
    },
  });

  let exam;
  if (sessionMatch) {
    resolvedSessionId = sessionMatch.id;
    exam = sessionMatch.exam;
  } else {
    exam = await db.exam.findUnique({
      where: { openCode: upperCode },
      select: {
        id: true,
        accessMode: true,
        status: true,
        openAt: true,
        closeAt: true,
        durationMin: true,
        openMaxAttempts: true,
        shuffleQuestions: true,
        shuffleOptions: true,
        courseId: true,
        kind: true,
      },
    });
  }
  if (!exam) throw new ExamError("invalid_code");
  // A6.3 — Vấn đáp AI KHÔNG đi qua đường thí sinh ẩn danh/mã dự thi: phạm vi
  // hiện tại chỉ sinh viên đã đăng nhập + đã ghi danh (xem oral-attempts.ts).
  // Không chặn ở đây thì code sẽ tạo ra 1 ExamAttempt "trần" rồi renderer cũ
  // (exam-take/[attemptId] → ExamPlayer) hiện ra như thi viết 0 câu hỏi —
  // đúng lỗi đã gặp khi mở buổi vấn đáp qua "Link thi nhanh" và share mã.
  if (exam.kind === "oral") {
    throw new ExamError("exam_not_written", {
      reason: "oral_requires_login",
      message:
        "Đây là đề vấn đáp AI — sinh viên vào thi qua trang khoá học sau khi đăng nhập, không dùng mã này.",
    });
  }
  if (exam.accessMode !== "open_code" && !sessionMatch)
    throw new ExamError("access_mode_mismatch");
  if (exam.status !== "published") throw new ExamError("exam_not_open");
  // PR2.12 — Khi code resolve qua ExamSession (mỗi ca 1 mã + cửa sổ riêng) thì
  // kiểm tra cửa sổ CỦA CA, không phải cửa sổ Exam cha. Landing page (exam/[code])
  // cũng so theo session.opensAt/closesAt → giữ đồng nhất, tránh case "landing mở
  // nhưng claim báo đã đóng". Mã không gắn ca thì không mở được — ca thi là
  // tầng duy nhất quyết định giờ.
  const now = new Date();
  if (sessionMatch) {
    // Ca thi quyết định — hẹn giờ so cửa sổ, thủ công so status.
    const state = sessionOpenState(sessionMatch, now);
    if (state === "not_yet") throw new ExamError("exam_not_open");
    if (state === "closed") throw new ExamError("exam_window_closed");
  } else {
    // Mã cũ gắn thẳng vào Exam, không qua ca nào. Ca thi là tầng duy nhất quyết
    // định giờ mở/đóng, nên mã không có ca thì không mở được — thay vì rơi về
    // khung giờ của đề, thứ mà giao diện đã ngừng cho sửa.
    throw new ExamError("exam_not_open", {
      reason: "no_session",
      message: "Mã này chưa gắn ca thi nào. Hãy phát lại link từ màn hình đề.",
    });
  }
  // Null khi ca thủ công — computeTtlSec xử lý riêng.
  const closeAt = sessionMatch.closesAt;

  const input: OpenClaimInput = parseOpenInput(rawInput);

  // PR2.12 — Validate cohortId server-side (client preview is convenience,
  // not trust boundary). Cohort phải cùng course với exam.
  let resolvedCohortId: string | null = null;
  if (input.cohortId) {
    const cohort = await db.courseSection.findUnique({
      where: { id: input.cohortId },
      select: { courseId: true },
    });
    if (cohort && cohort.courseId === exam.courseId) {
      resolvedCohortId = input.cohortId;
    }
    // Silent drop nếu cohort không match — không reject claim vì cohort là optional.
  }

  // A5.3 PR1c.4 — Open-code self-register cũng phải gắn candidate vào 1
  // ExamSession. Ensure default session trước transaction để tránh nhập-lồng
  // bằng cách insert ExamRound/ExamSession trong nested tx (risk dead-lock).
  // PR2.12 — Nếu code resolve qua ExamSession.openCode → dùng đúng session đó
  // (mỗi ca 1 mã). Fallback ensureDefaultSession chỉ khi vẫn dùng Exam.openCode.
  const sessionId =
    resolvedSessionId ?? (await ensureDefaultSession(exam.id, db));

  // Không cho thời hạn làm bài vượt giờ đóng ca (xem capDurationToWindow).
  const durationSec = capDurationToWindow(
    await resolveDurationSec(exam.durationMin, sessionId, db),
    closeAt,
    now,
  );

  // Resolve room:
  //   - Nhập mã phòng → lookup theo (sessionId, accessCode). Sai → reject.
  //   - Bỏ trống → fallback sang phòng default của ca thi (nếu có).
  //   - Ca thi chưa có phòng → roomId=null, instructor assign sau.
  let resolvedRoomId: string | null = null;
  if (input.roomCode) {
    const room = await db.examRoom.findFirst({
      where: { sessionId, accessCode: input.roomCode },
      select: { id: true },
    });
    if (!room) throw new ExamError("invalid_code", "invalid_room_code");
    resolvedRoomId = room.id;
  } else {
    const defaultRoom = await db.examRoom.findFirst({
      where: { sessionId, isDefault: true },
      select: { id: true },
    });
    resolvedRoomId = defaultRoom?.id ?? null;
  }

  const claim = await (db as typeof prisma).$transaction(
    async (tx) => {
      // Khoá theo (ca, MSSV) để hai lượt vào đồng thời (bấm đúp, hai máy cùng
      // lúc) xếp hàng: lượt sau thấy candidate của lượt trước thay vì cùng tạo mới.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${sessionId}:${input.studentCode.toUpperCase()}`}))`;

      const existing = await tx.examCandidate.findFirst({
        where: {
          sessionId,
          OR: [
            { metadata: { path: ["studentCode"], equals: input.studentCode } },
            { metadata: { path: ["studentCode"], equals: input.studentCode.toUpperCase() } },
            { metadata: { path: ["studentCode"], equals: input.studentCode.toLowerCase() } },
          ],
        },
        select: {
          id: true,
          displayName: true,
          metadata: true,
          disabledAt: true,
          attempts: {
            orderBy: { startedAt: "desc" },
            take: 1,
            select: { id: true, status: true },
          },
        },
      });

      if (existing) {
        if (existing.disabledAt) throw new ExamError("candidate_disabled");
        const last = existing.attempts[0];
        if (last) {
          if (last.status !== "in_progress")
            throw new ExamError("attempt_already_submitted");
          if (!isSameOwner(existing, input, now)) throw new ExamError("student_code_in_use");
          // Quyền vào lại của giảng viên chỉ dùng MỘT lần: thu hồi, và lấy thông tin
          // vừa nhập làm yếu tố xác thực mới (họ tên gốc giữ nguyên cho bảng điểm).
          if (hasActiveReentryGrant(existing.metadata, now)) {
            const {
              reentryGrantedUntil: _grant,
              email: _email,
              phone: _phone,
              ...rest
            } = existing.metadata as Record<string, unknown>;
            await tx.examCandidate.update({
              where: { id: existing.id },
              data: {
                metadata: {
                  ...rest,
                  ...(input.email ? { email: input.email } : {}),
                  ...(input.phone ? { phone: input.phone } : {}),
                } as never,
              },
            });
          }
          const newToken = randomUUID();
          await tx.examAttempt.update({
            where: { id: last.id },
            data: {
              sessionToken: newToken,
              resumeCount: { increment: 1 },
              lastHeartbeatAt: now,
            },
          });
          return {
            candidateId: existing.id,
            attemptId: last.id,
            sessionToken: newToken,
            resumed: true,
            displayName: existing.displayName,
          };
        }
        // Candidate có sẵn nhưng chưa từng vào bài: dùng lại, chỉ tạo attempt.
        const a = await tx.examAttempt.create({
          data: {
            examId: exam.id,
            candidateId: existing.id,
            candidateDisplayName: existing.displayName,
            sessionId,
            durationSec,
            status: "in_progress",
            lastHeartbeatAt: now,
          },
          select: { id: true, sessionToken: true },
        });
        const snap = await buildShuffleSnapshot(
          exam.id,
          a.id,
          exam.shuffleQuestions,
          exam.shuffleOptions,
          tx as typeof prisma,
        );
        await tx.examAttempt.update({
          where: { id: a.id },
          data: { shuffleSnapshot: snap as unknown as Prisma.InputJsonValue },
        });
        return {
          candidateId: existing.id,
          attemptId: a.id,
          sessionToken: a.sessionToken,
          resumed: false,
          displayName: existing.displayName,
        };
      }

      // Cap on total candidates (anti-spam — Q2 IP rate-limit is layered on
      // top). Chỉ áp cho người MỚI: người vào lại không được bị chặn vì ca đầy.
      if (exam.openMaxAttempts !== null && exam.openMaxAttempts !== undefined) {
        const used = await tx.examCandidate.count({ where: { examId: exam.id } });
        if (used >= exam.openMaxAttempts)
          throw new ExamError("open_max_attempts_reached");
      }

      const c = await tx.examCandidate.create({
        data: {
          examId: exam.id,
          sessionId,
          cohortId: resolvedCohortId,
          roomId: resolvedRoomId,
          displayName: input.displayName,
          metadata: {
            studentCode: input.studentCode,
            ...(input.phone ? { phone: input.phone } : {}),
            ...(input.email ? { email: input.email } : {}),
            ...(input.class ? { class: input.class } : {}),
          },
        },
        select: { id: true },
      });
      const a = await tx.examAttempt.create({
        data: {
          examId: exam.id,
          candidateId: c.id,
          candidateDisplayName: input.displayName,
          sessionId,
          durationSec,
          status: "in_progress",
          lastHeartbeatAt: now,
        },
        select: { id: true, sessionToken: true },
      });
      const snapshot = await buildShuffleSnapshot(
        exam.id,
        a.id,
        exam.shuffleQuestions,
        exam.shuffleOptions,
        tx as typeof prisma,
      );
      await tx.examAttempt.update({
        where: { id: a.id },
        data: { shuffleSnapshot: snapshot as unknown as Prisma.InputJsonValue },
      });
      return {
        candidateId: c.id,
        attemptId: a.id,
        sessionToken: a.sessionToken,
        resumed: false,
        displayName: input.displayName,
      };
    },
  );
  const { candidateId, attemptId, sessionToken, resumed } = claim;

  // Candidate chỉ được tạo một lần; vào lại thì chỉ ghi sự kiện claim.
  if (!resumed) {
    await emitEvent(
      null,
      LearningEventType.ExamCandidateCreated,
      { examId: exam.id, candidateId, mode: "open_code" },
      {
        courseId: exam.courseId,
        candidateId,
        eventKey: `exam.candidate.created:${candidateId}`,
      },
      db,
    );
  }
  await emitEvent(
    null,
    LearningEventType.ExamCandidateCodeClaimed,
    { examId: exam.id, candidateId, attemptId, mode: "open_code", resumed },
    {
      courseId: exam.courseId,
      candidateId,
      // Mỗi lần vào lại là một lượt claim riêng, đừng để dedupe nuốt mất.
      eventKey: resumed
        ? `exam.candidate.code_claimed:${attemptId}:${Date.now()}`
        : `exam.candidate.code_claimed:${attemptId}`,
    },
    db,
  );

  return {
    candidateId,
    attemptId,
    examId: exam.id,
    sessionToken,
    displayName: claim.displayName,
    resumed,
    ttlSec: computeTtlSec(closeAt),
  };
}

function parseOpenInput(raw: unknown): OpenClaimInput {
  if (!raw || typeof raw !== "object")
    throw new ExamError("candidate_name_required");
  const r = raw as Record<string, unknown>;
  return {
    displayName: normaliseName(r.displayName),
    studentCode: normaliseStudentCode(r.studentCode),
    phone: normalisePhone(r.phone),
    email: normaliseEmail(r.email),
    class:
      typeof r.class === "string" && r.class.trim().length > 0
        ? r.class.trim().slice(0, 100)
        : undefined,
    cohortId:
      typeof r.cohortId === "string" && r.cohortId.trim().length > 0
        ? r.cohortId.trim()
        : undefined,
    roomCode:
      typeof r.roomCode === "string" && r.roomCode.trim().length > 0
        ? r.roomCode.trim().toUpperCase()
        : undefined,
  };
}

/** Q5: assigned-mode claim. Resumes if candidate already has an attempt. */
export async function claimByAssignedCode(
  code: unknown,
  db: PrismaClient = prisma,
): Promise<ClaimResult> {
  if (typeof code !== "string" || code.trim().length === 0)
    throw new ExamError("invalid_code");
  const candidate = await db.examCandidate.findFirst({
    where: { accessCode: code.trim().toUpperCase() },
    select: {
      id: true,
      examId: true,
      sessionId: true,
      displayName: true,
      disabledAt: true,
      session: {
        select: {
          opensAt: true,
          closesAt: true,
          timingMode: true,
          status: true,
        },
      },
      exam: {
        select: {
          id: true,
          accessMode: true,
          status: true,
          openAt: true,
          closeAt: true,
          durationMin: true,
          shuffleQuestions: true,
          shuffleOptions: true,
          courseId: true,
          kind: true,
        },
      },
    },
  });
  if (!candidate) throw new ExamError("invalid_code");
  if (candidate.disabledAt) throw new ExamError("candidate_disabled");
  const exam = candidate.exam;
  // A6.3 — cùng lý do với claimByOpenCode ở trên: vấn đáp AI không có khái
  // niệm ExamCandidate/mã dự thi (chưa từng có UI tạo candidate cho oral,
  // nên nhánh này thực ra chưa ai tới được — chặn cho chắc, không giả định).
  if (exam.kind === "oral") {
    throw new ExamError("exam_not_written", {
      reason: "oral_requires_login",
      message:
        "Đây là đề vấn đáp AI — sinh viên vào thi qua trang khoá học sau khi đăng nhập, không dùng mã này.",
    });
  }
  if (exam.accessMode !== "assigned_code")
    throw new ExamError("access_mode_mismatch");
  if (exam.status !== "published") throw new ExamError("exam_not_open");
  // PR2.12 — Kiểm tra cửa sổ CỦA CA (candidate.session) nếu có, fallback exam
  // window. Đồng nhất với landing page (exam/[code]): ca thi quyết định, và
  // thí sinh chưa xếp ca thì chưa vào được.
  const now = new Date();
  if (candidate.session) {
    const state = sessionOpenState(candidate.session, now);
    if (state === "not_yet") throw new ExamError("exam_not_open");
    if (state === "closed") throw new ExamError("exam_window_closed");
  } else {
    throw new ExamError("exam_not_open", {
      reason: "no_session",
      message: "Thí sinh này chưa được xếp vào ca thi nào.",
    });
  }
  const closeAt = candidate.session.closesAt;

  // Q5: 1 candidate = 1 attempt. Resume if in progress, reject if submitted.
  const existing = await db.examAttempt.findFirst({
    where: { examId: exam.id, candidateId: candidate.id },
    select: { id: true, status: true, sessionToken: true },
  });

  let attemptId: string;
  let sessionToken: string;
  let resumed = false;

  if (existing) {
    if (existing.status !== "in_progress")
      throw new ExamError("attempt_already_submitted");
    // Rotate sessionToken on re-claim (mirrors User flow A7.4.7).
    const newToken = randomUUID();
    await db.examAttempt.update({
      where: { id: existing.id },
      data: {
        sessionToken: newToken,
        resumeCount: { increment: 1 },
        lastHeartbeatAt: now,
      },
    });
    attemptId = existing.id;
    sessionToken = newToken;
    resumed = true;
  } else {
    const durationSec = capDurationToWindow(
      await resolveDurationSec(exam.durationMin, candidate.sessionId, db),
      closeAt,
      now,
    );
    const a = await db.examAttempt.create({
      data: {
        examId: exam.id,
        candidateId: candidate.id,
        candidateDisplayName: candidate.displayName,
        sessionId: candidate.sessionId,
        durationSec,
        status: "in_progress",
        lastHeartbeatAt: now,
      },
      select: { id: true, sessionToken: true },
    });
    const snapshot = await buildShuffleSnapshot(
      exam.id,
      a.id,
      exam.shuffleQuestions,
      exam.shuffleOptions,
      db,
    );
    await db.examAttempt.update({
      where: { id: a.id },
      data: { shuffleSnapshot: snapshot as unknown as Prisma.InputJsonValue },
    });
    attemptId = a.id;
    sessionToken = a.sessionToken;
  }

  await emitEvent(
    null,
    LearningEventType.ExamCandidateCodeClaimed,
    {
      examId: exam.id,
      candidateId: candidate.id,
      attemptId,
      mode: "assigned_code",
      resumed,
    },
    {
      courseId: exam.courseId,
      candidateId: candidate.id,
      // One key per (attempt, claim-count) so retries aren't deduped silently.
      eventKey: resumed
        ? `exam.candidate.code_claimed:${attemptId}:${Date.now()}`
        : `exam.candidate.code_claimed:${attemptId}`,
    },
    db,
  );

  return {
    candidateId: candidate.id,
    attemptId,
    examId: exam.id,
    sessionToken,
    displayName: candidate.displayName,
    resumed,
    ttlSec: computeTtlSec(closeAt),
  };
}
