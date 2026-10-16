/**
 * Nhập hàng loạt cho MỘT ca thi: phòng + giám thị + lớp học + thí sinh, từ một
 * bảng dán.
 *
 * Thay cho `bulkImportRoundFull` (cấp đợt, mỗi dòng phải ghi "mã ca thi"). Ở
 * cấp ca thì ca đã biết từ trang đang đứng, nên bỏ cột đó. Mỗi dòng có thể là:
 *   - một PHÒNG (không có họ tên): chỉ dựng phòng/lớp, như bản cũ;
 *   - một THÍ SINH (có họ tên) kèm phòng của họ: dựng phòng nếu chưa có rồi
 *     thêm thí sinh vào đó — danh sách phẳng, xuất thẳng từ Excel của phòng ĐT.
 * Nhiều dòng cùng `mã lớp thi` là cùng một phòng; giá trị đầu tiên khác rỗng
 * của dòng trong nhóm thắng.
 *
 * Mỗi dòng báo `skipped` riêng với lý do — không bao giờ hỏng cả lượt vì một
 * dòng xấu. Chạy lại cùng dữ liệu là an toàn: phòng nhận ra theo tên, thí sinh
 * trùng email/MSSV/họ tên trong ca bị bỏ qua (đếm vào candidatesSkipped).
 */
import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { findOrInviteUserByEmail } from "../auth/invite";

type InviteTemplateKey = Parameters<typeof findOrInviteUserByEmail>[0]["templateKey"];
import { generateUniqueRoomCode } from "./exam-rooms";
import { addCandidatesToRoom, canEditSession } from "./exam-rounds";
import { courseIdOf, emitOrganizeEvent } from "./organize-events";
import { ExamError } from "./types";

export interface SessionImportRow {
  /** Mã lớp thi — chính là TÊN PHÒNG. Bắt buộc. */
  examClassCode: string;
  /** Mã lớp học (CourseSection.code). Bỏ trống = không gắn lớp học. */
  cohortCode?: string | null;
  /** Email giảng viên chủ nhiệm lớp học; chưa có tài khoản thì mời. */
  instructorEmail?: string | null;
  roomLocation?: string | null;
  /** Email giám thị; bỏ trống = người đang nhập. Chưa có tài khoản thì mời. */
  proctorEmail?: string | null;
  stt?: number | null;
  /** Có họ tên = dòng này là một thí sinh của phòng. */
  displayName?: string | null;
  email?: string | null;
  mssv?: string | null;
}

export interface SessionImportResult {
  roomsCreated: number;
  roomsUpdated: number;
  cohortsCreated: number;
  cohortsUpdated: number;
  examClassesCreated: number;
  candidatesAdded: number;
  candidatesSkipped: number;
  invited: number;
  /** true khi đề không thuộc khoá học: không có lớp học để gắn. */
  cohortLayerSkipped: boolean;
  skipped: Array<{ row: number; reason: string; detail?: string }>;
}

const MAX_ROWS = 2000;

const s = (v: string | null | undefined) => (v ?? "").trim();

export async function importSessionRooms(
  actorUserId: string,
  sessionId: string,
  rows: SessionImportRow[],
  baseUrl: string,
  db: PrismaClient = prisma,
): Promise<SessionImportResult> {
  if (rows.length === 0)
    throw new ExamError("validation_failed", { reason: "no_rows" });
  if (rows.length > MAX_ROWS)
    throw new ExamError("validation_failed", { reason: "too_many_rows", max: MAX_ROWS });

  const session = await db.examSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      roundId: true,
      examId: true,
      exam: {
        select: {
          courseId: true,
          kind: true,
          course: { select: { organizationId: true } },
        },
      },
    },
  });
  if (!session) throw new ExamError("schedule_not_found");
  if (!(await canEditSession(actorUserId, { roundId: session.roundId, examId: session.examId }, db)))
    throw new ExamError("forbidden");
  if (session.exam.kind === "oral")
    throw new ExamError("exam_not_written", {
      reason: "oral_has_no_rooms",
      message: "Đề vấn đáp AI không dùng phòng/danh sách thí sinh.",
    });

  const courseId = session.exam.courseId;
  const organizationId = session.exam.course?.organizationId ?? null;

  const result: SessionImportResult = {
    roomsCreated: 0,
    roomsUpdated: 0,
    cohortsCreated: 0,
    cohortsUpdated: 0,
    examClassesCreated: 0,
    candidatesAdded: 0,
    candidatesSkipped: 0,
    invited: 0,
    cohortLayerSkipped: false,
    skipped: [],
  };

  // Gom theo phòng, giữ thứ tự xuất hiện. Thông tin phòng lấy từ giá trị đầu
  // tiên khác rỗng của nhóm; số dòng gốc giữ lại để báo lỗi đúng chỗ.
  type Group = {
    code: string;
    firstRow: number;
    cohortCode: string;
    instructorEmail: string;
    roomLocation: string;
    proctorEmail: string;
    stt: number | null;
    candidates: Array<{ row: number; displayName: string; email: string | null; mssv: string | null }>;
  };
  const groups = new Map<string, Group>();
  rows.forEach((r, i) => {
    const row = i + 1;
    const code = s(r.examClassCode).toUpperCase();
    if (!code) {
      result.skipped.push({ row, reason: "missing_room_code" });
      return;
    }
    let g = groups.get(code);
    if (!g) {
      g = {
        code,
        firstRow: row,
        cohortCode: "",
        instructorEmail: "",
        roomLocation: "",
        proctorEmail: "",
        stt: null,
        candidates: [],
      };
      groups.set(code, g);
    }
    g.cohortCode ||= s(r.cohortCode).toUpperCase();
    g.instructorEmail ||= s(r.instructorEmail);
    g.roomLocation ||= s(r.roomLocation);
    g.proctorEmail ||= s(r.proctorEmail);
    if (g.stt === null && typeof r.stt === "number" && Number.isFinite(r.stt)) g.stt = r.stt;
    if (s(r.displayName))
      g.candidates.push({
        row,
        displayName: s(r.displayName),
        email: s(r.email) || null,
        mssv: s(r.mssv) || null,
      });
  });

  const invite = async (
    email: string,
    templateKey: InviteTemplateKey,
  ): Promise<string | null> => {
    const inv = await findOrInviteUserByEmail({
      email,
      displayName: email.split("@")[0]!,
      baseUrl,
      templateKey,
      organizationId,
      db,
    });
    if (inv.invited) result.invited++;
    return inv.userId;
  };

  if (!courseId) result.cohortLayerSkipped = true;

  // Khoá nhận diện thí sinh: email > MSSV > họ tên. Nạp một lần các thí sinh
  // đã có trong ca để chạy lại cùng dữ liệu không nhân đôi.
  const candidateKey = (c: {
    displayName: string;
    email: string | null;
    mssv: string | null;
  }) =>
    c.email
      ? `e:${c.email.toLowerCase()}`
      : c.mssv
        ? `m:${c.mssv.toLowerCase()}`
        : `n:${c.displayName.toLowerCase()}`;
  const existingKeys = new Set<string>();
  const existing = await db.examCandidate.findMany({
    where: { sessionId },
    select: { displayName: true, metadata: true },
  });
  for (const c of existing) {
    const md = (c.metadata ?? {}) as { email?: string; studentCode?: string };
    existingKeys.add(
      candidateKey({
        displayName: c.displayName,
        email: md.email ?? null,
        mssv: md.studentCode ?? null,
      }),
    );
  }

  for (const g of groups.values()) {
    try {
      // 1. Giám thị: có email thì tìm/mời; không thì chính người đang nhập —
      //    giống phòng mặc định, vì ExamRoom.proctorUserId là NOT NULL.
      let proctorUserId = actorUserId;
      if (g.proctorEmail) {
        try {
          proctorUserId = (await invite(g.proctorEmail, "exam.proctor_invite_bulk")) ?? actorUserId;
        } catch {
          result.skipped.push({ row: g.firstRow, reason: "invalid_proctor_email", detail: g.proctorEmail });
          continue;
        }
      }

      // 2. Lớp học + lớp thi (chỉ khi đề thuộc khoá học và dòng có mã lớp học).
      if (courseId && g.cohortCode) {
        let instructorId: string | null = null;
        if (g.instructorEmail) {
          try {
            instructorId = await invite(g.instructorEmail, "exam.instructor_invite_bulk");
          } catch {
            result.skipped.push({ row: g.firstRow, reason: "invalid_gv_email", detail: g.instructorEmail });
            continue;
          }
        }
        const existingCohort = await db.courseSection.findFirst({
          where: { courseId, code: g.cohortCode },
          select: { id: true },
        });
        let cohortId: string;
        if (existingCohort) {
          if (instructorId)
            await db.courseSection.update({
              where: { id: existingCohort.id },
              data: { instructorId },
            });
          cohortId = existingCohort.id;
          result.cohortsUpdated++;
        } else {
          const created = await db.courseSection.create({
            data: { courseId, code: g.cohortCode, name: g.cohortCode, instructorId },
            select: { id: true },
          });
          cohortId = created.id;
          result.cohortsCreated++;
        }

        const expected = g.candidates.length > 0 ? g.candidates.length : null;
        const existingClass = await db.cohortExamClass.findFirst({
          where: { courseId, code: g.code },
          select: { id: true, cohortId: true },
        });
        if (existingClass) {
          if (existingClass.cohortId !== cohortId) {
            result.skipped.push({
              row: g.firstRow,
              reason: "exam_class_owned_by_other_cohort",
              detail: g.code,
            });
            continue;
          }
          await db.cohortExamClass.update({
            where: { id: existingClass.id },
            data: {
              roomLocation: g.roomLocation || null,
              ...(expected !== null ? { expectedStudentCount: expected } : {}),
            },
          });
        } else {
          await db.cohortExamClass.create({
            data: {
              cohortId,
              courseId,
              code: g.code,
              roomLocation: g.roomLocation || null,
              expectedStudentCount: expected,
            },
          });
          result.examClassesCreated++;
        }
      }

      // 3. Phòng: tên = mã lớp thi; có rồi thì cập nhật giám thị/địa điểm.
      let roomId: string;
      const existingRoom = await db.examRoom.findFirst({
        where: { sessionId, name: g.code },
        select: { id: true },
      });
      if (existingRoom) {
        await db.examRoom.update({
          where: { id: existingRoom.id },
          data: {
            ...(g.proctorEmail ? { proctorUserId } : {}),
            ...(g.roomLocation ? { locationNote: g.roomLocation } : {}),
            ...(g.stt !== null ? { sourceRowNum: g.stt } : {}),
          },
        });
        roomId = existingRoom.id;
        result.roomsUpdated++;
      } else {
        const maxOrder = await db.examRoom.aggregate({
          where: { sessionId },
          _max: { orderIndex: true },
        });
        const hasDefault = await db.examRoom.findFirst({
          where: { sessionId, isDefault: true },
          select: { id: true },
        });
        const created = await db.examRoom.create({
          data: {
            sessionId,
            examId: session.examId,
            name: g.code,
            locationNote: g.roomLocation || null,
            proctorUserId,
            orderIndex: (maxOrder._max.orderIndex ?? 0) + 1,
            sourceRowNum: g.stt,
            accessCode: await generateUniqueRoomCode(sessionId, db),
            isDefault: !hasDefault,
          },
          select: { id: true },
        });
        roomId = created.id;
        result.roomsCreated++;
      }

      // 4. Thí sinh của phòng (nếu dòng có họ tên). addCandidatesToRoom không
      //    tự bỏ thí sinh đã có, nên lọc trùng ở đây — theo cả CA, vì một thí
      //    sinh nằm hai phòng của cùng ca là dữ liệu sai chứ không phải hợp lệ.
      const fresh = g.candidates.filter((c) => {
        const k = candidateKey(c);
        if (existingKeys.has(k)) {
          result.candidatesSkipped++;
          return false;
        }
        existingKeys.add(k);
        return true;
      });
      for (let i = 0; i < fresh.length; i += 500) {
        const chunk = fresh.slice(i, i + 500);
        try {
          const r = await addCandidatesToRoom(
            actorUserId,
            roomId,
            {
              candidates: chunk.map((c) => ({
                displayName: c.displayName,
                email: c.email,
                mssv: c.mssv,
              })),
            },
            db,
          );
          result.candidatesAdded += r.added;
          result.candidatesSkipped += r.skipped;
        } catch (e) {
          result.skipped.push({
            row: chunk[0]!.row,
            reason: e instanceof ExamError ? e.code : "error",
            detail:
              e instanceof ExamError
                ? JSON.stringify(e.details ?? {}).slice(0, 200)
                : (e as Error).message,
          });
        }
      }
    } catch (e) {
      result.skipped.push({
        row: g.firstRow,
        reason: e instanceof ExamError ? e.code : "error",
        detail: (e as Error).message,
      });
    }
  }

  // Một sự kiện cho cả lượt nhập (phòng tạo mới + thí sinh do
  // addCandidatesToRoom đã tự phát). Chỉ số lượng, KHÔNG email hay mã.
  if (result.roomsCreated > 0)
    await emitOrganizeEvent(
      actorUserId,
      LearningEventType.ExamRoomCreated,
      { sessionId, count: result.roomsCreated, bulk: true, source: "session_import" },
      await courseIdOf({ sessionId }, db),
      db,
    );

  return result;
}
