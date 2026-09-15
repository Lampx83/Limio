/**
 * PR2.15 — Bulk import "full row" cho 1 round.
 * Mỗi row gắn liền:
 *   - Cohort (mã_lớp_học + email_GV)
 *   - CohortExamClass (mã_lớp_thi + địa_điểm)
 *   - ExamRoom (trong ExamSession resolve theo mã_ca_thi)
 *   - Proctor của ExamRoom (find/invite by email)
 *
 * Output báo từng metric: cohortsCreated/Updated, examClassesCreated, roomsCreated,
 * invited (tổng số email được invite), skipped per row với reason.
 */
import { prisma, type PrismaClient } from "@feedbackme/db";
import { findOrInviteUserByEmail } from "../auth/invite";
import { canEditExamRound } from "./exam-rounds";
import { generateUniqueRoomCode } from "./exam-rooms";
import { ExamError } from "./types";

export interface FullImportRow {
  cohortCode: string;
  instructorEmail?: string | null;
  examClassCode: string;
  studentCount?: number | null;
  roomLocation?: string | null;
  proctorEmail?: string | null;
  sessionCode: string;
  // PR2.18 — STT user-provided từ cột "STT" của Excel. Lưu vào ExamRoom.sourceRowNum
  // để sort/đối chiếu.
  stt?: number | null;
}

export interface FullImportResult {
  cohortsCreated: number;
  cohortsUpdated: number;
  examClassesCreated: number;
  roomsCreated: number;
  invited: number;
  skipped: Array<{ row: number; reason: string; detail?: string }>;
}

export async function bulkImportRoundFull(
  actorUserId: string,
  roundId: string,
  rows: FullImportRow[],
  baseUrl: string,
  db: PrismaClient = prisma,
): Promise<FullImportResult> {
  if (!(await canEditExamRound(actorUserId, roundId, db)))
    throw new ExamError("forbidden");

  const round = await db.examRound.findUniqueOrThrow({
    where: { id: roundId },
    select: {
      courseId: true,
      // For per-org email template lookup on proctor/instructor invites.
      course: { select: { organizationId: true } },
    },
  });
  // Cohort/CohortExamClass đều bắt buộc gắn courseId — bulk-import cohort chỉ
  // có ý nghĩa với đợt thi gắn khoá học (đợt tự sinh cho đề độc lập không
  // dùng tính năng này).
  if (!round.courseId) {
    throw new ExamError("validation_failed", {
      reason: "round_has_no_course",
      message: "Đợt thi này không gắn khoá học — không nhập cohort hàng loạt được.",
    });
  }
  const organizationId = round.course?.organizationId ?? null;

  // Pre-load all sessions in this round so we can resolve session codes
  // case-insensitive without N+1 queries.
  const sessions = await db.examSession.findMany({
    where: { roundId },
    select: { id: true, code: true, examId: true },
  });
  const sessionByCode = new Map<string, { id: string; examId: string }>();
  for (const s of sessions) {
    if (s.code) sessionByCode.set(s.code.trim().toUpperCase(), { id: s.id, examId: s.examId });
  }

  const result: FullImportResult = {
    cohortsCreated: 0,
    cohortsUpdated: 0,
    examClassesCreated: 0,
    roomsCreated: 0,
    invited: 0,
    skipped: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    const lineNum = i + 1;
    try {
      const cohortCode = r.cohortCode.trim().toUpperCase();
      const examClassCode = r.examClassCode.trim().toUpperCase();
      const sessionCode = r.sessionCode.trim().toUpperCase();
      if (!cohortCode || !examClassCode || !sessionCode) {
        result.skipped.push({ row: lineNum, reason: "missing_required" });
        continue;
      }

      // 1. Resolve session by code in this round.
      const session = sessionByCode.get(sessionCode);
      if (!session) {
        result.skipped.push({
          row: lineNum,
          reason: "session_not_found",
          detail: sessionCode,
        });
        continue;
      }

      // 2. Cohort: find/invite GV, then upsert cohort.
      let instructorId: string | null = null;
      if (r.instructorEmail) {
        try {
          const inv = await findOrInviteUserByEmail({
            email: r.instructorEmail,
            displayName: r.instructorEmail.split("@")[0]!,
            baseUrl,
            templateKey: "exam.instructor_invite_bulk",
            organizationId,
            db,
          });
          instructorId = inv.userId;
          if (inv.invited) result.invited++;
        } catch {
          result.skipped.push({ row: lineNum, reason: "invalid_gv_email" });
          continue;
        }
      }

      const existingCohort = await db.courseSection.findFirst({
        where: { courseId: round.courseId, code: cohortCode },
        select: { id: true },
      });
      let cohortId: string;
      if (existingCohort) {
        await db.courseSection.update({
          where: { id: existingCohort.id },
          data: { instructorId: instructorId ?? undefined },
        });
        cohortId = existingCohort.id;
        result.cohortsUpdated++;
      } else {
        const created = await db.courseSection.create({
          data: {
            courseId: round.courseId,
            code: cohortCode,
            name: cohortCode,
            instructorId,
          },
          select: { id: true },
        });
        cohortId = created.id;
        result.cohortsCreated++;
      }

      // 3. CohortExamClass: upsert by (courseId, code).
      const existingClass = await db.cohortExamClass.findFirst({
        where: { courseId: round.courseId, code: examClassCode },
        select: { id: true, cohortId: true },
      });
      if (existingClass) {
        if (existingClass.cohortId !== cohortId) {
          result.skipped.push({
            row: lineNum,
            reason: "exam_class_owned_by_other_cohort",
            detail: examClassCode,
          });
          continue;
        }
        await db.cohortExamClass.update({
          where: { id: existingClass.id },
          data: {
            roomLocation: r.roomLocation?.trim() || null,
            expectedStudentCount:
              typeof r.studentCount === "number" && r.studentCount > 0
                ? r.studentCount
                : null,
          },
        });
      } else {
        await db.cohortExamClass.create({
          data: {
            cohortId,
            courseId: round.courseId,
            code: examClassCode,
            roomLocation: r.roomLocation?.trim() || null,
            expectedStudentCount:
              typeof r.studentCount === "number" && r.studentCount > 0
                ? r.studentCount
                : null,
          },
        });
        result.examClassesCreated++;
      }

      // 4. ExamRoom: tạo trong session, name = examClassCode, location = roomLocation.
      //    Proctor: find/invite by email.
      let proctorUserId: string | null = null;
      if (r.proctorEmail) {
        try {
          const inv = await findOrInviteUserByEmail({
            email: r.proctorEmail,
            displayName: r.proctorEmail.split("@")[0]!,
            baseUrl,
            templateKey: "exam.proctor_invite_bulk",
            organizationId,
            db,
          });
          proctorUserId = inv.userId;
          if (inv.invited) result.invited++;
        } catch {
          result.skipped.push({ row: lineNum, reason: "invalid_proctor_email" });
          continue;
        }
      }
      if (!proctorUserId) {
        // Proctor required for ExamRoom (proctorUserId is NOT NULL).
        result.skipped.push({ row: lineNum, reason: "proctor_required" });
        continue;
      }

      // Skip create if a room with same name already exists in this session
      // (idempotent re-run).
      const existingRoom = await db.examRoom.findFirst({
        where: { sessionId: session.id, name: examClassCode },
        select: { id: true },
      });
      if (!existingRoom) {
        const maxOrder = await db.examRoom.aggregate({
          where: { sessionId: session.id },
          _max: { orderIndex: true },
        });
        const accessCode = await generateUniqueRoomCode(session.id, db);
        const hasDefault = await db.examRoom.findFirst({
          where: { sessionId: session.id, isDefault: true },
          select: { id: true },
        });
        await db.examRoom.create({
          data: {
            sessionId: session.id,
            examId: session.examId,
            name: examClassCode,
            locationNote: r.roomLocation?.trim() || null,
            proctorUserId,
            orderIndex: (maxOrder._max.orderIndex ?? 0) + 1,
            sourceRowNum: r.stt ?? null,
            accessCode,
            isDefault: !hasDefault,
          },
        });
        result.roomsCreated++;
      } else {
        // Update proctor + location + source row if changed.
        await db.examRoom.update({
          where: { id: existingRoom.id },
          data: {
            proctorUserId,
            locationNote: r.roomLocation?.trim() || null,
            sourceRowNum: r.stt ?? null,
          },
        });
      }
    } catch (e) {
      result.skipped.push({
        row: lineNum,
        reason: e instanceof ExamError ? e.code : "error",
        detail: (e as Error).message,
      });
    }
  }

  return result;
}
