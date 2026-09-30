/**
 * OrgAdmin (hoặc Platform Admin) quản lý user thuộc trường mình: gắn/gỡ
 * `User.organizationId`. User không thuộc trường nào (`organizationId = null`)
 * không phải lỗi — coi như đang ở "nhóm chung" của platform (tự đăng ký,
 * chưa trường nào nhận). Gỡ khỏi trường = đưa về nhóm chung, không xoá user.
 */
import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { isAdmin, isOrgAdminOf } from "../auth/roles";
import { logAudit } from "../auth/audit";
import { emitEvent } from "../learning/events";
import { findOrInviteUserByEmail } from "../auth/invite";

export class OrgMemberError extends Error {
  constructor(
    public readonly code:
      | "forbidden"
      | "org_not_found"
      | "invalid_email"
      | "already_member"
      | "belongs_to_other_org"
      | "not_member"
      | "user_not_found",
  ) {
    super(code);
  }
}

async function assertOrgAdmin(
  actorUserId: string,
  organizationId: string,
  db: PrismaClient,
): Promise<void> {
  if (!(await isOrgAdminOf(actorUserId, organizationId, db))) {
    throw new OrgMemberError("forbidden");
  }
}

export interface OrgMemberRow {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  roles: string[];
  createdAt: Date;
}

export interface ListOrgMembersResult {
  members: OrgMemberRow[];
  total: number;
  page: number;
  limit: number;
}

/** Danh sách user thuộc 1 trường (paginated, tìm theo email/tên). */
export async function listOrgMembers(
  actorUserId: string,
  organizationId: string,
  opts: { q?: string; page?: number; limit?: number } = {},
  db: PrismaClient = prisma,
): Promise<ListOrgMembersResult> {
  await assertOrgAdmin(actorUserId, organizationId, db);

  const page = Math.max(0, opts.page ?? 0);
  const limit = Math.min(100, Math.max(1, opts.limit ?? 25));
  const q = opts.q?.trim();

  const where = {
    organizationId,
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" as const } },
            { displayName: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: page * limit,
      take: limit,
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        createdAt: true,
        userRoles: { select: { role: { select: { name: true } } } },
      },
    }),
  ]);

  return {
    total,
    page,
    limit,
    members: rows.map((u) => ({
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      createdAt: u.createdAt,
      roles: Array.from(new Set(u.userRoles.map((ur) => ur.role.name))),
    })),
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Thêm user vào trường theo email. User đã có tài khoản (chưa thuộc trường
 * nào khác) → gắn thẳng organizationId. Chưa có tài khoản → tạo Learner mới
 * (không mật khẩu) + gửi email mời đặt mật khẩu, giống luồng
 * findOrInviteUserByEmail dùng cho mời GV/giám thị.
 */
export async function addOrgMember(
  actorUserId: string,
  organizationId: string,
  input: { email: string; displayName?: string; baseUrl: string; sendInvite?: boolean },
  db: PrismaClient = prisma,
): Promise<{ userId: string; invited: boolean; created: boolean }> {
  await assertOrgAdmin(actorUserId, organizationId, db);

  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true },
  });
  if (!org) throw new OrgMemberError("org_not_found");

  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new OrgMemberError("invalid_email");

  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true, organizationId: true },
  });

  let userId: string;
  let invited = false;
  let created = false;

  if (existing) {
    if (existing.organizationId === organizationId) {
      throw new OrgMemberError("already_member");
    }
    if (existing.organizationId) {
      throw new OrgMemberError("belongs_to_other_org");
    }
    await db.user.update({
      where: { id: existing.id },
      data: { organizationId },
    });
    userId = existing.id;
  } else {
    const result = await findOrInviteUserByEmail({
      email,
      displayName: input.displayName ?? email.split("@")[0]!,
      baseUrl: input.baseUrl,
      templateKey: "org.member_invite",
      organizationId,
      extraVariables: { orgName: org.name },
      sendInvite: input.sendInvite,
      db,
    });
    userId = result.userId;
    invited = result.invited;
    created = result.created;
    // findOrInviteUserByEmail chỉ set organizationId lúc TẠO user mới — nếu
    // email đã tồn tại (race hiếm) thì rơi vào nhánh existing ở trên rồi, nên
    // ở đây user chắc chắn vừa được tạo với organizationId đúng.
  }

  await logAudit(
    {
      action: "org_member.added",
      actorUserId,
      targetUserId: userId,
      payload: { organizationId, invited },
    },
    db,
  );
  await emitEvent(
    actorUserId,
    LearningEventType.OrgMemberAdded,
    { organizationId, targetUserId: userId },
    { eventKey: `org.member.added:${organizationId}:${userId}` },
    db,
  );

  return { userId, invited, created };
}

/** Gỡ user khỏi trường — đưa về "nhóm chung" (organizationId = null). Không xoá user. */
export async function removeOrgMember(
  actorUserId: string,
  organizationId: string,
  targetUserId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  await assertOrgAdmin(actorUserId, organizationId, db);

  const user = await db.user.findUnique({
    where: { id: targetUserId },
    select: { organizationId: true },
  });
  if (!user || user.organizationId !== organizationId) {
    throw new OrgMemberError("not_member");
  }

  await db.user.update({
    where: { id: targetUserId },
    data: { organizationId: null },
  });

  await logAudit(
    {
      action: "org_member.removed",
      actorUserId,
      targetUserId,
      payload: { organizationId },
    },
    db,
  );
  await emitEvent(
    actorUserId,
    LearningEventType.OrgMemberRemoved,
    { organizationId, targetUserId },
    { eventKey: `org.member.removed:${organizationId}:${targetUserId}:${Date.now()}` },
    db,
  );
}

/**
 * Platform Admin gắn / đổi / gỡ organization của một user bất kỳ.
 * Khác addOrgMember (OrgAdmin, chỉ nhận user chưa thuộc trường nào): ở đây
 * cho phép chuyển thẳng từ trường này sang trường khác, và `organizationId =
 * null` đưa về "nhóm chung". Chỉ Platform Admin — OrgAdmin không được kéo
 * user ra khỏi trường khác.
 */
export async function assignUserOrganization(
  actorUserId: string,
  targetUserId: string,
  organizationId: string | null,
  db: PrismaClient = prisma,
): Promise<{ from: string | null; to: string | null }> {
  if (!(await isAdmin(actorUserId, db))) throw new OrgMemberError("forbidden");

  const user = await db.user.findUnique({
    where: { id: targetUserId },
    select: { organizationId: true },
  });
  if (!user) throw new OrgMemberError("user_not_found");

  if (organizationId) {
    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!org) throw new OrgMemberError("org_not_found");
  }

  const from = user.organizationId;
  if (from === organizationId) return { from, to: organizationId };

  await db.user.update({
    where: { id: targetUserId },
    data: { organizationId },
  });

  await logAudit(
    {
      action: "user.organization_changed",
      actorUserId,
      targetUserId,
      payload: { from, to: organizationId },
    },
    db,
  );
  const at = Date.now();
  if (from) {
    await emitEvent(
      actorUserId,
      LearningEventType.OrgMemberRemoved,
      { organizationId: from, targetUserId },
      { eventKey: `org.member.removed:${from}:${targetUserId}:${at}` },
      db,
    );
  }
  if (organizationId) {
    await emitEvent(
      actorUserId,
      LearningEventType.OrgMemberAdded,
      { organizationId, targetUserId },
      { eventKey: `org.member.added:${organizationId}:${targetUserId}:${at}` },
      db,
    );
  }

  return { from, to: organizationId };
}
