/**
 * Giám thị vào bằng mã, không cần tài khoản.
 *
 * Trước đây muốn coi thi phải (a) có tài khoản trên hệ thống và (b) được gán
 * `ExamRoom.proctorUserId`. Với giám thị thuê ngoài hoặc cán bộ coi thi của
 * khoa khác, cả hai bước đó phải làm xong TRƯỚC giờ thi — mà thực tế phân công
 * giám thị hay đổi vào phút chót.
 *
 * Nay mỗi phòng có thêm `proctorCode`. Ai cầm mã thì vào được đúng phòng đó.
 *
 * VÌ SAO KHÔNG DÙNG LẠI `ExamRoom.accessCode`: mã đó là mã phát cho THÍ SINH
 * (giao diện ghi "Mã phòng cho thí sinh", và nó được in lên phiếu dự thi). Nếu
 * nó cũng mở được màn giám sát thì mọi thí sinh trong phòng đều xem được tiến
 * độ và tên của nhau. Mã giám thị phải là mã thứ hai, không bao giờ chiếu lên.
 */

import { prisma, type PrismaClient } from "@feedbackme/db";
import { openReentryGrant } from "./attempt-actions";
import { emitEvent } from "../learning/events";
import { LearningEventType } from "@feedbackme/shared-types";
import { ExamError } from "./types";
import { sessionOpenState } from "./session-window";

/** Bỏ I, L, O, 0, 1 — người đọc mã qua điện thoại hay nhầm. */
const PROCTOR_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const PROCTOR_CODE_LEN = 8;

function randomProctorCode(): string {
  const buf = new Uint8Array(PROCTOR_CODE_LEN);
  crypto.getRandomValues(buf);
  let s = "";
  for (const b of buf) s += PROCTOR_CODE_ALPHABET[b % PROCTOR_CODE_ALPHABET.length];
  return s;
}

/**
 * Sinh mã chưa ai dùng. Unique toàn hệ thống nên phải hỏi DB, không như mã
 * phòng (chỉ cần unique trong ca).
 */
async function generateUniqueProctorCode(db: PrismaClient): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = randomProctorCode();
    const clash = await db.examRoom.findUnique({
      where: { proctorCode: code },
      select: { id: true },
    });
    if (!clash) return code;
  }
  // 31^8 ≈ 8.5e11 — cạn 8 lần liên tiếp nghĩa là có gì đó hỏng, không phải xui.
  throw new ExamError("validation_failed", {
    reason: "proctor_code_generation_failed",
  });
}

/**
 * Trả mã giám thị của phòng, sinh nếu chưa có.
 *
 * Sinh lười thay vì backfill trong migration: phòng cũ chỉ cần mã đúng lúc
 * người tổ chức mở ra xem để gửi đi.
 *
 * Authz do caller lo (route gọi assertCanEditCourse / canProctorRoom).
 */
export async function ensureProctorCode(
  roomId: string,
  db: PrismaClient = prisma,
): Promise<string> {
  const room = await db.examRoom.findUnique({
    where: { id: roomId },
    select: { proctorCode: true },
  });
  if (!room) throw new ExamError("validation_failed", { reason: "room_not_found" });
  if (room.proctorCode) return room.proctorCode;

  const code = await generateUniqueProctorCode(db);
  await db.examRoom.update({
    where: { id: roomId },
    data: { proctorCode: code },
  });
  return code;
}

/** Đổi mã mới, vô hiệu mã cũ ngay. Dùng khi mã lỡ lọt ra ngoài. */
export async function rotateProctorCode(
  roomId: string,
  db: PrismaClient = prisma,
): Promise<string> {
  const code = await generateUniqueProctorCode(db);
  await db.examRoom.update({ where: { id: roomId }, data: { proctorCode: code } });
  return code;
}

export interface ProctorClaim {
  roomId: string;
  sessionId: string;
  examId: string;
  roomName: string;
  examTitle: string;
  sessionTitle: string | null;
  locationNote: string | null;
}

/**
 * Đổi mã lấy phòng. Ném `invalid_code` cho mọi trường hợp không vào được —
 * mã sai, ca đã đóng, ca chưa tới giờ — để người dò mã không phân biệt được
 * "mã sai" với "mã đúng nhưng chưa mở".
 */
export async function claimProctorCode(
  rawCode: unknown,
  now: Date = new Date(),
  db: PrismaClient = prisma,
): Promise<ProctorClaim> {
  if (typeof rawCode !== "string") throw new ExamError("invalid_code");
  const code = rawCode.trim().toUpperCase();
  if (code.length !== PROCTOR_CODE_LEN) throw new ExamError("invalid_code");

  const room = await db.examRoom.findUnique({
    where: { proctorCode: code },
    select: {
      id: true,
      name: true,
      locationNote: true,
      examId: true,
      sessionId: true,
      exam: { select: { title: true } },
      session: {
        select: {
          id: true,
          title: true,
          code: true,
          opensAt: true,
          closesAt: true,
          timingMode: true,
          status: true,
        },
      },
    },
  });
  if (!room) throw new ExamError("invalid_code");

  // Ca đã đóng thì mã hết tác dụng. Giám thị cần xem lại buổi cũ thì đi đường
  // giảng viên — mã coi thi không nên sống mãi sau khi thi xong.
  if (sessionOpenState(room.session, now) === "closed")
    throw new ExamError("invalid_code");

  return {
    roomId: room.id,
    sessionId: room.sessionId,
    examId: room.examId,
    roomName: room.name,
    examTitle: room.exam.title,
    sessionTitle: room.session.title ?? room.session.code,
    locationNote: room.locationNote,
  };
}

export interface ProctorRoomCandidate {
  candidateId: string;
  displayName: string;
  accessCode: string | null;
  arrivedAt: string | null;
  /** null = chưa vào thi. */
  attemptStatus: "in_progress" | "submitted" | "auto_submitted" | "graded" | "flagged" | null;
  submittedAt: string | null;
  /** Số câu đã trả lời — để giám thị biết ai đang ngồi im. */
  answered: number;
}

export interface ProctorRoomView {
  roomName: string;
  examTitle: string;
  sessionTitle: string | null;
  locationNote: string | null;
  totalQuestions: number;
  candidates: ProctorRoomCandidate[];
}

/**
 * Toàn bộ dữ liệu màn giám thị trong MỘT lần đọc.
 *
 * Không nhận userId: người gọi đã chứng minh quyền bằng cookie đổi từ mã.
 * Route phải xác thực cookie trước khi gọi.
 */
export async function getProctorRoomView(
  roomId: string,
  db: PrismaClient = prisma,
): Promise<ProctorRoomView> {
  const room = await db.examRoom.findUnique({
    where: { id: roomId },
    select: {
      name: true,
      locationNote: true,
      examId: true,
      exam: { select: { title: true, _count: { select: { questions: true } } } },
      session: { select: { title: true, code: true } },
      candidates: {
        orderBy: { displayName: "asc" },
        select: {
          id: true,
          displayName: true,
          accessCode: true,
          arrivedAt: true,
          attempts: {
            orderBy: { startedAt: "desc" },
            take: 1,
            select: {
              status: true,
              submittedAt: true,
              _count: { select: { answers: true } },
            },
          },
        },
      },
    },
  });
  if (!room) throw new ExamError("validation_failed", { reason: "room_not_found" });

  return {
    roomName: room.name,
    examTitle: room.exam.title,
    sessionTitle: room.session.title ?? room.session.code,
    locationNote: room.locationNote,
    totalQuestions: room.exam._count.questions,
    candidates: room.candidates.map((c) => {
      const a = c.attempts[0] ?? null;
      return {
        candidateId: c.id,
        displayName: c.displayName,
        accessCode: c.accessCode,
        arrivedAt: c.arrivedAt?.toISOString() ?? null,
        attemptStatus: (a?.status ?? null) as ProctorRoomCandidate["attemptStatus"],
        submittedAt: a?.submittedAt?.toISOString() ?? null,
        answered: a?._count.answers ?? 0,
      };
    }),
  };
}

/**
 * Điểm danh — bản cho giám thị vào bằng mã.
 *
 * Khác `setCandidateAttendance` ở chỗ không có actorUserId để kiểm quyền; thay
 * vào đó BẮT BUỘC truyền roomId lấy từ cookie, và thí sinh phải thuộc đúng
 * phòng đó. Cầm mã phòng A thì không điểm danh được người phòng B.
 */
export async function setAttendanceByProctorCode(
  roomId: string,
  candidateId: string,
  present: boolean,
  db: PrismaClient = prisma,
): Promise<{ arrivedAt: string | null }> {
  const c = await db.examCandidate.findUnique({
    where: { id: candidateId },
    select: { roomId: true },
  });
  if (!c || c.roomId !== roomId) throw new ExamError("forbidden");

  const updated = await db.examCandidate.update({
    where: { id: candidateId },
    data: { arrivedAt: present ? new Date() : null },
    select: { arrivedAt: true },
  });
  return { arrivedAt: updated.arrivedAt?.toISOString() ?? null };
}

export interface OrganizerRoomRow {
  roomId: string;
  name: string;
  proctorName: string;
  locationNote: string | null;
  proctorCode: string;
  candidates: number;
  arrived: number;
  started: number;
  submitted: number;
}

/**
 * Các phòng của một ca, kèm mã giám thị — dữ liệu cho phần bung ra ở danh sách
 * "Tổ chức thi".
 *
 * Gom mã giám thị vào đây thay vì bắt người tổ chức đi đợt → ca → phòng bốn
 * lần bấm chỉ để copy một mã. Trước giờ thi họ cần phát mã cho TẤT CẢ phòng,
 * nên thao tác đó phải nằm trong một màn.
 *
 * Sinh mã cho phòng nào chưa có, ngay lúc đọc. Authz do route lo (getExamSession).
 */
export async function listRoomsForOrganizer(
  sessionId: string,
  db: PrismaClient = prisma,
): Promise<OrganizerRoomRow[]> {
  const rooms = await db.examRoom.findMany({
    where: { sessionId },
    orderBy: { orderIndex: "asc" },
    select: {
      id: true,
      name: true,
      locationNote: true,
      proctorCode: true,
      proctor: { select: { displayName: true } },
      candidates: {
        select: {
          arrivedAt: true,
          attempts: {
            orderBy: { startedAt: "desc" },
            take: 1,
            select: { status: true },
          },
        },
      },
    },
  });

  const out: OrganizerRoomRow[] = [];
  for (const r of rooms) {
    // Tuần tự chứ không Promise.all: mã phải unique toàn hệ thống, mà kiểm tra
    // trùng rồi ghi song song thì hai phòng có thể cùng nhắm một mã.
    const code = r.proctorCode ?? (await ensureProctorCode(r.id, db));
    const started = r.candidates.filter((c) => c.attempts.length > 0).length;
    const submitted = r.candidates.filter(
      (c) => c.attempts[0] && c.attempts[0].status !== "in_progress",
    ).length;
    out.push({
      roomId: r.id,
      name: r.name,
      proctorName: r.proctor.displayName,
      locationNote: r.locationNote,
      proctorCode: code,
      candidates: r.candidates.length,
      arrived: r.candidates.filter((c) => c.arrivedAt !== null).length,
      started,
      submitted,
    });
  }
  return out;
}

/**
 * Cho một thí sinh vào lại bài đang làm dở — bản cho giám thị vào bằng mã phòng.
 *
 * Thí sinh vào bằng mã thi mở phải nhập lại đúng email/SĐT đã dùng lúc đầu mới vào
 * lại được bài (xem isSameOwner trong code-access.ts); người quên thì kẹt. Giám thị
 * đang đứng trong phòng, nhìn thấy người đó, là người phù hợp nhất để gỡ. Như
 * `setAttendanceByProctorCode`, roomId lấy từ cookie và thí sinh phải thuộc đúng phòng
 * đó — cầm mã phòng A không mở được người phòng B. Quyền dùng một lần, hết hạn sau
 * ít phút (xem openReentryGrant).
 */
export async function grantReentryByProctorCode(
  roomId: string,
  candidateId: string,
  db: PrismaClient = prisma,
): Promise<{ expiresAt: Date }> {
  const c = await db.examCandidate.findUnique({
    where: { id: candidateId },
    select: {
      roomId: true,
      examId: true,
      exam: { select: { courseId: true } },
      attempts: { where: { status: "in_progress" }, orderBy: { startedAt: "desc" }, take: 1, select: { id: true } },
    },
  });
  if (!c || c.roomId !== roomId) throw new ExamError("forbidden");
  const attempt = c.attempts[0];
  // Thí sinh chưa vào thi / đã nộp: không có bài dở nào để mở lại.
  if (!attempt) throw new ExamError("attempt_not_in_progress");

  const g = await openReentryGrant(attempt.id, db);
  // Giám thị không có tài khoản: chủ thể của sự kiện là thí sinh được mở.
  await emitEvent(
    null,
    LearningEventType.ExamAttemptSessionReset,
    {
      examId: c.examId,
      attemptId: attempt.id,
      candidateId,
      roomId,
      action: "reentry_granted",
      by: "proctor_code",
      expiresAt: g.expiresAt.toISOString(),
    },
    {
      courseId: c.exam.courseId ?? undefined,
      candidateId,
      eventKey: `exam.attempt.reentry_granted:${attempt.id}:${Date.now()}`,
    },
    db,
  );
  return { expiresAt: g.expiresAt };
}
