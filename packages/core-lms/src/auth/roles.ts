import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { RoleName } from "@feedbackme/shared-types";
import { logAudit } from "./audit";
import type { DbClient } from "./tokens";

export const GrantRoleInput = z.object({
  targetUserId: z.string().uuid(),
  roleName: z.enum([
    RoleName.Learner,
    RoleName.Instructor,
    RoleName.Admin,
    RoleName.Mentor,
  ]),
  // null/undefined = platform-wide grant. Set for course-scoped roles.
  courseId: z.string().uuid().optional().nullable(),
});

export const RevokeRoleInput = z.object({
  userRoleId: z.string().uuid(),
});

export class RoleError extends Error {
  constructor(
    public readonly code:
      | "validation_failed"
      | "role_not_found"
      | "user_role_not_found"
      | "course_not_found",
  ) {
    super(code);
  }
}

/**
 * Idempotent: if the (userId, roleName, courseId) tuple already exists, no-op.
 * Always writes an AuditLog entry on actual change.
 */
export async function grantRole(
  actorUserId: string,
  rawInput: unknown,
  db: DbClient = prisma,
): Promise<{ userRoleId: string; created: boolean }> {
  const parsed = GrantRoleInput.safeParse(rawInput);
  if (!parsed.success) throw new RoleError("validation_failed");
  const { targetUserId, roleName, courseId } = parsed.data;

  const role = await db.role.findUnique({ where: { name: roleName } });
  if (!role) throw new RoleError("role_not_found");

  if (courseId) {
    const course = await db.course.findUnique({ where: { id: courseId } });
    if (!course) throw new RoleError("course_not_found");
  }

  // Compound unique with nullable courseId — use findFirst to allow `courseId: null`.
  const existing = await db.userRole.findFirst({
    where: {
      userId: targetUserId,
      roleId: role.id,
      courseId: courseId ?? null,
    },
  });
  if (existing) return { userRoleId: existing.id, created: false };

  const userRole = await db.userRole.create({
    data: {
      userId: targetUserId,
      roleId: role.id,
      courseId: courseId ?? null,
      grantedBy: actorUserId,
    },
  });
  await logAudit(
    {
      action: "role.granted",
      actorUserId,
      targetUserId,
      payload: { roleName, courseId: courseId ?? null, userRoleId: userRole.id },
    },
    db,
  );
  return { userRoleId: userRole.id, created: true };
}

export async function revokeRole(
  actorUserId: string,
  rawInput: unknown,
  db: DbClient = prisma,
): Promise<void> {
  const parsed = RevokeRoleInput.safeParse(rawInput);
  if (!parsed.success) throw new RoleError("validation_failed");

  const userRole = await db.userRole.findUnique({
    where: { id: parsed.data.userRoleId },
    include: { role: true },
  });
  if (!userRole) throw new RoleError("user_role_not_found");

  await db.userRole.delete({ where: { id: userRole.id } });
  await logAudit(
    {
      action: "role.revoked",
      actorUserId,
      targetUserId: userRole.userId,
      payload: {
        roleName: userRole.role.name,
        courseId: userRole.courseId,
        userRoleId: userRole.id,
      },
    },
    db,
  );
}

export interface UserRoleSummary {
  userRoleId: string;
  roleName: string;
  courseId: string | null;
}

/**
 * Return roles applicable in a given context.
 * If `courseId` is provided: returns platform-wide roles + roles scoped to that course.
 * If omitted: returns all roles (platform + every course-scoped role).
 */
export async function getRolesForUser(
  userId: string,
  courseId?: string | null,
  db: DbClient = prisma,
): Promise<UserRoleSummary[]> {
  const rows = await db.userRole.findMany({
    where: {
      userId,
      ...(courseId !== undefined
        ? { OR: [{ courseId: null }, { courseId }] }
        : {}),
    },
    include: { role: true },
  });
  return rows.map((r) => ({
    userRoleId: r.id,
    roleName: r.role.name,
    courseId: r.courseId,
  }));
}

export async function isAdmin(userId: string, db: DbClient = prisma): Promise<boolean> {
  const count = await db.userRole.count({
    where: {
      userId,
      role: { name: RoleName.Admin },
    },
  });
  return count > 0;
}

/**
 * True nếu user có vai trò Instructor (platform-wide hoặc trên ÍT NHẤT 1 course).
 * Dùng cho các action liên quan đến content authoring (vd tạo Skill toàn cục
 * khi tag câu hỏi/quiz/lesson). Admin cũng coi là instructor cho mục đích này.
 */
export async function isInstructor(
  userId: string,
  db: DbClient = prisma,
): Promise<boolean> {
  const count = await db.userRole.count({
    where: {
      userId,
      role: { name: { in: [RoleName.Instructor, RoleName.Admin] } },
    },
  });
  return count > 0;
}

// ============================================================================
// PR2.17 — Multi-tenancy helpers
// ============================================================================

/**
 * Lấy organizationId của user. Null nếu user chưa thuộc org nào (legacy
 * data hoặc test fixture).
 */
export async function getUserOrgId(
  userId: string,
  db: DbClient = prisma,
): Promise<string | null> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  return u?.organizationId ?? null;
}

/** True nếu user là OrgAdmin của bất kỳ org nào, hoặc Platform Admin. */
export async function isAnyOrgAdmin(
  userId: string,
  db: DbClient = prisma,
): Promise<boolean> {
  if (await isAdmin(userId, db)) return true;
  const count = await db.organizationAdmin.count({ where: { userId } });
  return count > 0;
}

/** True nếu user là OrgAdmin của 1 org cụ thể, hoặc Platform Admin. */
export async function isOrgAdminOf(
  userId: string,
  organizationId: string,
  db: DbClient = prisma,
): Promise<boolean> {
  if (await isAdmin(userId, db)) return true;
  const row = await db.organizationAdmin.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { userId: true },
  });
  return row !== null;
}

/**
 * Trả về danh sách orgId mà user có quyền truy cập:
 * - Platform admin → null (= bypass, không scope)
 * - Otherwise → user's own org + orgs họ là OrgAdmin
 *
 * Null nghĩa là caller skip mọi filter (super access).
 */
export async function accessibleOrgIds(
  userId: string,
  db: DbClient = prisma,
): Promise<string[] | null> {
  if (await isAdmin(userId, db)) return null;
  const [user, admins] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    }),
    db.organizationAdmin.findMany({
      where: { userId },
      select: { organizationId: true },
    }),
  ]);
  const ids = new Set<string>();
  if (user?.organizationId) ids.add(user.organizationId);
  for (const a of admins) ids.add(a.organizationId);
  return Array.from(ids);
}
