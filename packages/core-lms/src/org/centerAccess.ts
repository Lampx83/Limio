/**
 * Bật tính năng trung tâm theo tổ chức (CENTER, docs/CENTER-schedule-attendance-AC.md mục G).
 *
 * "Tính năng trung tâm" = lịch dạy, giáo trình dựng sẵn, điểm danh, chuyên cần. Chỉ ẩn/hiện ở GIAO DIỆN
 * (menu, trang, khối trên trang lớp); dữ liệu và API không đổi, nên bật/tắt không làm mất dữ liệu nào.
 *
 * Giảng viên thấy tính năng khi MỘT trong ba điều đúng:
 *   (a) trường của họ bật (Organization.centerEnabled);
 *   (b) cờ `center.access` đúng cho riêng họ (cơ chế cờ tính năng có sẵn — dùng cho tài khoản chưa thuộc trường);
 *   (c) họ đang dạy một khoá có lớp đã đặt lịch (để không ai bị mất lối vào dữ liệu đã có);
 *   (d) họ là giảng viên trung tâm (vai trò chỉ có ý nghĩa trong trung tâm).
 * Học viên thấy "Lịch học" khi đang học ở một lớp có buổi (điều kiện theo dữ liệu, không theo trường).
 */
import { prisma, type PrismaClient } from "@feedbackme/db";
import type { DbClient } from "../auth/tokens";
import { isAdmin, isCenterTeacher, isOrgAdminOf } from "../auth/roles";
import { logAudit } from "../auth/audit";
import { isFeatureEnabled } from "../auth/permissions";
import { OrgMemberError } from "./members";

export const CENTER_FEATURE_KEY = "center.access";

/** Platform Admin hoặc OrgAdmin của chính trường đó bật/tắt tính năng trung tâm cho trường. */
export async function setOrgCenterEnabled(
  actorUserId: string,
  organizationId: string,
  enabled: boolean,
  db: PrismaClient = prisma,
): Promise<{ centerEnabled: boolean }> {
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { centerEnabled: true } });
  // Phân quyền trước, để người ngoài không dò được trường nào tồn tại.
  if (!(await isAdmin(actorUserId, db)) && !(await isOrgAdminOf(actorUserId, organizationId, db))) {
    throw new OrgMemberError("forbidden");
  }
  if (!org) throw new OrgMemberError("org_not_found");
  if (org.centerEnabled === enabled) return { centerEnabled: enabled };

  await db.$transaction(async (tx) => {
    await tx.organization.update({ where: { id: organizationId }, data: { centerEnabled: enabled } });
    await logAudit(
      {
        action: "org.center_setting_changed",
        actorUserId,
        payload: { organizationId, from: org.centerEnabled, to: enabled },
      },
      tx,
    );
  });
  return { centerEnabled: enabled };
}

/** Giảng viên có được thấy tính năng trung tâm không (xem đầu file). */
export async function isCenterEnabledForUser(userId: string, db: DbClient = prisma): Promise<boolean> {
  if (await isCenterTeacher(userId, db)) return true;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { organization: { select: { centerEnabled: true } } },
  });
  if (user?.organization?.centerEnabled) return true;

  // Cờ riêng. Thiếu dòng cờ (chưa seed) hay lỗi khác đều coi là tắt: menu không được hỏng vì một cờ.
  try {
    if (await isFeatureEnabled(userId, CENTER_FEATURE_KEY, db as PrismaClient)) return true;
  } catch {
    /* coi là tắt */
  }

  const taught = await db.classSchedule.findFirst({
    where: { section: { course: { instructors: { some: { userId } } } } },
    select: { id: true },
  });
  return taught !== null;
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
