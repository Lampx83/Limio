/**
 * Tính năng trung tâm theo LOẠI tổ chức (CENTER, docs/CENTER-schedule-attendance-AC.md mục G; chuẩn hoá giáo viên theo loại 2026-11-27,
 * docs/tieu-chi/giao-vien-theo-loai-to-chuc.md). Chỉ tổ chức loại `center` (xem orgKind.ts) có lịch dạy, giáo trình dựng sẵn, điểm danh,
 * chuyên cần; trường thường và nhà xuất bản thì giáo viên chỉ có phần giảng viên chuẩn.
 *
 * Chỉ ẩn/hiện ở GIAO DIỆN (menu, trang, khối trên trang lớp); dữ liệu và API không đổi, nên đổi loại không làm mất dữ liệu nào.
 *
 * Hai mức:
 *  - theo NGƯỜI (menu, trang "Lịch dạy"...): `isCenterEnabledForUser`;
 *  - theo KHOÁ (tab Lịch dạy và chuyên cần ở trang lớp): `isCenterCourse`.
 * Ngoại lệ giữ lối vào dữ liệu đã có: khoá nào đã có lớp đặt lịch thì luôn coi là khoá trung tâm, dù tổ chức là loại gì.
 * Đã bỏ: cờ riêng `center.access` và vai `center_teacher` đứng một mình (vai này chỉ cấp được trong trung tâm).
 * Học viên thấy "Lịch học" khi đang học ở một lớp có buổi (điều kiện theo dữ liệu, không theo loại tổ chức).
 */
import { prisma, type PrismaClient } from "@feedbackme/db";
import type { DbClient } from "../auth/tokens";
import { isAdmin, isOrgAdminOf } from "../auth/roles";
import { logAudit } from "../auth/audit";
import { OrgMemberError } from "./members";

/** Giảng viên có được thấy tính năng trung tâm không (xem đầu file). */
export async function isCenterEnabledForUser(userId: string, db: DbClient = prisma): Promise<boolean> {
  const [own, adminOfCenter, teachesInCenter, taughtScheduled] = await Promise.all([
    db.user.findFirst({ where: { id: userId, organization: { kind: "center" } }, select: { id: true } }),
    db.organizationAdmin.findFirst({ where: { userId, organization: { kind: "center" } }, select: { userId: true } }),
    db.courseInstructor.findFirst({ where: { userId, course: { organization: { kind: "center" } } }, select: { courseId: true } }),
    db.classSchedule.findFirst({ where: { section: { course: { instructors: { some: { userId } } } } }, select: { id: true } }),
  ]);
  return own !== null || adminOfCenter !== null || teachesInCenter !== null || taughtScheduled !== null;
}

/** Khoá này có dùng tính năng trung tâm không: tổ chức sở hữu là trung tâm, hoặc khoá đã có lớp đặt lịch (không mất lối vào dữ liệu). */
export async function isCenterCourse(courseId: string, db: DbClient = prisma): Promise<boolean> {
  const course = await db.course.findUnique({ where: { id: courseId }, select: { organization: { select: { kind: true } } } });
  if (course?.organization?.kind === "center") return true;
  return (await db.classSchedule.findFirst({ where: { section: { courseId } }, select: { id: true } })) !== null;
}

/** Học viên đang học ở lớp nào có buổi học không. */
export async function hasClassSchedule(userId: string, db: DbClient = prisma): Promise<boolean> {
  const m = await db.classMeeting.findFirst({
    where: { section: { enrollments: { some: { userId, status: { in: ["active", "completed"] } } } } },
    select: { id: true },
  });
  return m !== null;
}

/**
 * CENTER C5.4 — ngưỡng (phút) coi là "đúng giờ" khi giáo viên bắt đầu buổi và "không kết thúc sớm" khi đóng buổi.
 * Mặc định 15; quản trị trường đặt trong khoảng 5–120.
 */
export async function setOrgCheckinThreshold(
  actorUserId: string,
  organizationId: string,
  minutes: number,
  db: PrismaClient = prisma,
): Promise<{ checkinThresholdMin: number }> {
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { checkinThresholdMin: true } });
  if (!(await isAdmin(actorUserId, db)) && !(await isOrgAdminOf(actorUserId, organizationId, db))) {
    throw new OrgMemberError("forbidden");
  }
  if (!org) throw new OrgMemberError("org_not_found");
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 120) throw new OrgMemberError("validation_failed");
  if (org.checkinThresholdMin === minutes) return { checkinThresholdMin: minutes };
  await db.$transaction(async (tx) => {
    await tx.organization.update({ where: { id: organizationId }, data: { checkinThresholdMin: minutes } });
    await logAudit(
      { action: "org.checkin_threshold_changed", actorUserId, payload: { organizationId, from: org.checkinThresholdMin, to: minutes } },
      tx,
    );
  });
  return { checkinThresholdMin: minutes };
}
