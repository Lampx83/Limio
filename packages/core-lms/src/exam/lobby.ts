/**
 * Phòng chờ (lobby) trước giờ thi, và vào thi bằng tài khoản đã đăng nhập.
 *
 * Thứ tự quan trọng: lobby nằm TRƯỚC bước bấm vào thi. Bấm vào thi là lúc tạo
 * lượt làm và bắt đầu đếm giờ (xem claimByAssignedCode), nên học viên ngồi chờ
 * trong lobby không được bị trừ giờ. Lobby chỉ là trang chờ, không ghi gì vào
 * bài làm.
 *
 * Pha của ca (LobbyPhase):
 *   before  — còn xa giờ mở, chưa cho vào lobby;
 *   lobby   — trong khoảng LOBBY_LEAD_MIN phút trước giờ mở, hoặc ca thủ công
 *             đang nháp (chờ giảng viên bấm mở);
 *   open    — được bấm vào thi;
 *   closed  — đã đóng.
 *
 * Việc đếm người đang chờ (heartbeat, trong Redis) nằm ở tầng web; file này chỉ
 * giữ logic thuần và phần DB, nên core-lms không phụ thuộc hạ tầng nào khác.
 */
import { randomUUID } from "node:crypto";
import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { emitEvent } from "../learning/events";
import { buildShuffleSnapshot } from "./attempts";
import { computeTtlSec, resolveDurationSec, type ClaimResult } from "./code-access";
import { genAccessCode } from "./exam-rounds";
import {
  capDurationToWindow,
  sessionOpenState,
  type ExamSessionStatusValue,
  type ExamSessionTimingModeValue,
} from "./session-window";
import { ExamError } from "./types";

/** Mở lobby trước giờ thi bao nhiêu phút. */
export const LOBBY_LEAD_MIN = 15;

export type LobbyPhase = "before" | "lobby" | "open" | "closed";

export interface LobbyWindowInput {
  opensAt: Date;
  closesAt: Date | null;
  timingMode: ExamSessionTimingModeValue;
  status: ExamSessionStatusValue;
}

/** Ca đang ở pha nào vào thời điểm `now`. Pure — không đụng DB. */
export function lobbyPhase(s: LobbyWindowInput, now: Date): LobbyPhase {
  if (s.timingMode === "manual") {
    // Ca thủ công: giảng viên bấm mở. Nháp = đang chờ, lobby vẫn mở để học viên tới sớm.
    if (s.status === "open") return "open";
    if (s.status === "draft") return "lobby";
    return "closed";
  }
  const st = sessionOpenState(s, now);
  if (st === "open") return "open";
  if (st === "closed") return "closed";
  const leadStart = s.opensAt.getTime() - LOBBY_LEAD_MIN * 60_000;
  return now.getTime() >= leadStart ? "lobby" : "before";
}

export interface LobbyTarget {
  sessionId: string;
  examId: string;
  examTitle: string;
  courseId: string | null;
  /** open = mã chung của ca; assigned = mã cá nhân của thí sinh. */
  mode: "open" | "assigned";
  /** Chỉ có khi mode = assigned: thí sinh sở hữu mã (không cần tài khoản). */
  candidateId: string | null;
  candidateName: string | null;
  phase: LobbyPhase;
  opensAt: Date;
  closesAt: Date | null;
  /** Đề đã publish và không phải vấn đáp AI — mới vào lobby/thi qua mã được. */
  ready: boolean;
  isOral: boolean;
}

const SESSION_SELECT = {
  id: true,
  examId: true,
  opensAt: true,
  closesAt: true,
  timingMode: true,
  status: true,
  exam: { select: { title: true, status: true, kind: true, courseId: true } },
} as const;

/**
 * Tìm ca theo mã vào: 6 ký tự = mã chung của ca; 8 ký tự = mã cá nhân của thí sinh.
 * Trả null khi mã không tồn tại (hoặc thí sinh đã bị vô hiệu hoá).
 */
export async function resolveLobbyTarget(
  code: string,
  now: Date = new Date(),
  db: PrismaClient = prisma,
): Promise<LobbyTarget | null> {
  const c = code.trim().toUpperCase();
  let session;
  let mode: "open" | "assigned";
  let candidate: { id: string; displayName: string } | null = null;
  if (c.length === 6) {
    mode = "open";
    session = await db.examSession.findFirst({
      where: { openCode: c, accessMode: "open_code" },
      select: SESSION_SELECT,
    });
  } else if (c.length === 8) {
    mode = "assigned";
    const cand = await db.examCandidate.findFirst({
      where: { accessCode: c, disabledAt: null },
      select: { id: true, displayName: true, session: { select: SESSION_SELECT } },
    });
    session = cand?.session ?? null;
    candidate = cand ? { id: cand.id, displayName: cand.displayName } : null;
  } else {
    return null;
  }
  if (!session) return null;

  return {
    sessionId: session.id,
    examId: session.examId,
    examTitle: session.exam.title,
    courseId: session.exam.courseId,
    mode,
    candidateId: candidate?.id ?? null,
    candidateName: candidate?.displayName ?? null,
    phase: lobbyPhase(session, now),
    opensAt: session.opensAt,
    closesAt: session.closesAt,
    ready: session.exam.status === "published" && session.exam.kind === "written",
    isOral: session.exam.kind === "oral",
  };
}

/**
 * Vào thi bằng tài khoản đã đăng nhập, cho ca mã chung. Không hỏi họ tên hay MSSV:
 * lấy từ tài khoản.
 *
 * Nhận diện thí sinh trong ca theo thứ tự: đã gắn userId → email trùng với danh
 * sách đã nhập (import phòng) → tạo mới. Thí sinh có sẵn trong danh sách thì giữ
 * phòng đã xếp; thí sinh mới vào phòng mặc định của ca.
 *
 * Chỉ cho vào khi ca ở pha `open`. Lượt làm chỉ được tạo ở đây, không tạo khi chờ.
 */
export async function claimByAccount(
  code: unknown,
  userId: string,
  now: Date = new Date(),
  db: PrismaClient = prisma,
): Promise<ClaimResult> {
  if (typeof code !== "string" || code.trim().length === 0)
    throw new ExamError("invalid_code");
  const target = await resolveLobbyTarget(code, now, db);
  if (!target || target.mode !== "open") throw new ExamError("invalid_code");
  if (target.isOral)
    throw new ExamError("exam_not_written", {
      reason: "oral_requires_login",
      message: "Đề vấn đáp AI vào thi qua trang khoá học, không dùng mã này.",
    });
  if (!target.ready) throw new ExamError("exam_not_open");
  if (target.phase === "before" || target.phase === "lobby")
    throw new ExamError("exam_not_open");
  if (target.phase === "closed") throw new ExamError("exam_window_closed");

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, displayName: true, email: true },
  });
  if (!user) throw new ExamError("forbidden");

  const exam = await db.exam.findUniqueOrThrow({
    where: { id: target.examId },
    select: {
      durationMin: true,
      shuffleQuestions: true,
      shuffleOptions: true,
      openMaxAttempts: true,
    },
  });
  const sessionId = target.sessionId;
  const email = user.email.trim().toLowerCase();

  const result = await (db as typeof prisma).$transaction(async (tx) => {
    // Khoá theo (ca, tài khoản): bấm đúp hay hai tab cùng lúc xếp hàng, không tạo đôi.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${sessionId}:acct:${userId}`}))`;

    const roster = await tx.examCandidate.findMany({
      where: { sessionId },
      select: {
        id: true,
        userId: true,
        roomId: true,
        disabledAt: true,
        metadata: true,
      },
    });
    let candidate =
      roster.find((c) => c.userId === userId) ??
      roster.find((c) => {
        const md = (c.metadata ?? {}) as { email?: unknown };
        return typeof md.email === "string" && md.email.trim().toLowerCase() === email;
      }) ??
      null;

    if (candidate?.disabledAt) throw new ExamError("candidate_disabled");
    if (candidate?.userId && candidate.userId !== userId)
      throw new ExamError("forbidden", { reason: "candidate_linked_to_other_account" });

    const defaultRoom = await tx.examRoom.findFirst({
      where: { sessionId, isDefault: true },
      select: { id: true },
    });

    if (!candidate) {
      // Trần số thí sinh của đề (chống spam, cùng luật với claimByOpenCode). Chỉ áp
      // cho người MỚI: người đã có trong danh sách, hoặc vào lại, không bị chặn vì
      // ca đã đầy.
      if (exam.openMaxAttempts !== null && exam.openMaxAttempts !== undefined) {
        const used = await tx.examCandidate.count({ where: { examId: target.examId } });
        if (used >= exam.openMaxAttempts)
          throw new ExamError("open_max_attempts_reached");
      }
      const created = await tx.examCandidate.create({
        data: {
          examId: target.examId,
          sessionId,
          roomId: defaultRoom?.id ?? null,
          userId,
          displayName: user.displayName,
          accessCode: genAccessCode(),
          metadata: { email },
        },
        select: { id: true, roomId: true },
      });
      candidate = { id: created.id, userId, roomId: created.roomId, disabledAt: null, metadata: null };
    } else {
      const patch: { userId?: string; roomId?: string } = {};
      if (!candidate.userId) patch.userId = userId;
      if (!candidate.roomId && defaultRoom) patch.roomId = defaultRoom.id;
      if (Object.keys(patch).length > 0)
        await tx.examCandidate.update({ where: { id: candidate.id }, data: patch });
    }
    const candidateId = candidate.id;

    // Một thí sinh một bài làm trong đề này (xem claimByAssignedCode, quy tắc Q5).
    const existing = await tx.examAttempt.findFirst({
      where: { examId: target.examId, candidateId },
      select: { id: true, status: true },
    });

    if (existing) {
      if (existing.status !== "in_progress")
        throw new ExamError("attempt_already_submitted");
      const sessionToken = randomUUID();
      await tx.examAttempt.update({
        where: { id: existing.id },
        data: { sessionToken, resumeCount: { increment: 1 }, lastHeartbeatAt: now },
      });
      return {
        candidateId,
        attemptId: existing.id,
        sessionToken,
        resumed: true,
      };
    }

    const durationSec = capDurationToWindow(
      await resolveDurationSec(exam.durationMin, sessionId, tx as unknown as PrismaClient),
      target.closesAt,
      now,
    );
    const a = await tx.examAttempt.create({
      data: {
        examId: target.examId,
        candidateId,
        candidateDisplayName: user.displayName,
        sessionId,
        durationSec,
        status: "in_progress",
        lastHeartbeatAt: now,
      },
      select: { id: true, sessionToken: true },
    });
    const snapshot = await buildShuffleSnapshot(
      target.examId,
      a.id,
      exam.shuffleQuestions,
      exam.shuffleOptions,
      tx as unknown as PrismaClient,
    );
    await tx.examAttempt.update({
      where: { id: a.id },
      data: { shuffleSnapshot: snapshot as unknown as Prisma.InputJsonValue },
    });
    return { candidateId, attemptId: a.id, sessionToken: a.sessionToken, resumed: false };
  });

  await emitEvent(
    null,
    LearningEventType.ExamCandidateCodeClaimed,
    {
      examId: target.examId,
      candidateId: result.candidateId,
      attemptId: result.attemptId,
      mode: "account",
      resumed: result.resumed,
    },
    {
      courseId: target.courseId,
      candidateId: result.candidateId,
      eventKey: result.resumed
        ? `exam.candidate.code_claimed:${result.attemptId}:${Date.now()}`
        : `exam.candidate.code_claimed:${result.attemptId}`,
    },
    db,
  );

  return {
    candidateId: result.candidateId,
    attemptId: result.attemptId,
    examId: target.examId,
    sessionToken: result.sessionToken,
    displayName: user.displayName,
    resumed: result.resumed,
    ttlSec: computeTtlSec(target.closesAt),
  };
}
