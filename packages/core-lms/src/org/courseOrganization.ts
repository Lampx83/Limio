/**
 * Gắn / gỡ khoá khỏi tổ chức (docs/tieu-chi/bao-cao-nha-xuat-ban.md, AC8). CHỈ Platform Admin (thầy chốt 16/11/2026):
 * gắn khoá vào tổ chức nghĩa là cho OrgAdmin và người xem báo cáo của tổ chức thấy doanh thu và số liệu học tập
 * tổng hợp của khoá, nên đây là quyết định chia sẻ dữ liệu, không để chủ khoá hay OrgAdmin tự làm.
 * Mỗi lần đổi thật ghi AuditLog và sự kiện `course.organization.changed` (payload chỉ id).
 */
import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { isAdmin } from "../auth/roles";
import { logAudit } from "../auth/audit";
import { emitEvent } from "../learning/events";

export class CourseOrgError extends Error {
  constructor(public readonly code: "forbidden" | "course_not_found" | "org_not_found") {
    super(code);
  }
}

export async function setCourseOrganization(
  actorUserId: string,
  courseId: string,
  organizationId: string | null,
  db: PrismaClient = prisma,
): Promise<{ changed: boolean }> {
  if (!(await isAdmin(actorUserId, db))) throw new CourseOrgError("forbidden");
  const course = await db.course.findUnique({ where: { id: courseId }, select: { organizationId: true } });
  if (!course) throw new CourseOrgError("course_not_found");
  if (organizationId) {
    const org = await db.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
    if (!org) throw new CourseOrgError("org_not_found");
  }
  if (course.organizationId === organizationId) return { changed: false };

  await db.course.update({ where: { id: courseId }, data: { organizationId } });
  const payload = { courseId, fromOrganizationId: course.organizationId, toOrganizationId: organizationId };
  await logAudit({ action: "course.organization.changed", actorUserId, payload }, db);
  await emitEvent(
    actorUserId,
    LearningEventType.CourseOrganizationChanged,
    payload,
    { courseId, eventKey: `course.organization.changed:${courseId}:${Date.now()}` },
    db,
  );
  return { changed: true };
}
