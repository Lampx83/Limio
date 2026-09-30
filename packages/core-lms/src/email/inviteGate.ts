/**
 * Cổng bật/tắt mail mời theo cấu hình của trường (`Organization.invite*`).
 * Mọi đường "thêm người bằng email → tạo tài khoản → gửi mail mời" phải đi
 * qua đây (findOrInviteUserByEmail đã gọi sẵn) — thêm đường mới mà quên cổng
 * này là trường tắt mail rồi mà vẫn bị phát mail.
 *
 * Trường không xác định (organizationId = null) hoặc template không thuộc
 * nhóm nào ở dưới → gửi như trước (không có gì để tắt).
 */
import { prisma, type PrismaClient } from "@feedbackme/db";
import type { TemplateKey } from "./templates";

export type InviteEmailKind = "import" | "instructor" | "proctor";

/** Cột cấu hình tương ứng với từng nhóm mail mời. */
export const INVITE_KIND_COLUMN = {
  import: "inviteEmailOnImport",
  instructor: "inviteEmailOnInstructorAdd",
  proctor: "inviteEmailOnProctorAdd",
} as const satisfies Record<InviteEmailKind, string>;

/** Template nào thuộc nhóm nào (org.member_invite do luồng thành viên tự quyết). */
const TEMPLATE_KIND: Partial<Record<TemplateKey, InviteEmailKind>> = {
  "course.co_instructor_invite": "instructor",
  "cohort.instructor_invite": "instructor",
  "exam.instructor_invite_bulk": "instructor",
  "exam.proctor_invite": "proctor",
  "exam.proctor_invite_bulk": "proctor",
};

export function inviteKindForTemplate(key: TemplateKey): InviteEmailKind | null {
  return TEMPLATE_KIND[key] ?? null;
}

export async function isInviteEmailEnabled(
  kind: InviteEmailKind,
  organizationId: string | null | undefined,
  db: PrismaClient = prisma,
): Promise<boolean> {
  if (!organizationId) return true;
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      inviteEmailOnImport: true,
      inviteEmailOnInstructorAdd: true,
      inviteEmailOnProctorAdd: true,
    },
  });
  // Trường không tồn tại → không có cấu hình nào để tôn trọng.
  return org ? org[INVITE_KIND_COLUMN[kind]] : true;
}

/** Gộp 2 bước: template → nhóm → cấu hình của trường. */
export async function isInviteEmailEnabledForTemplate(
  key: TemplateKey,
  organizationId: string | null | undefined,
  db: PrismaClient = prisma,
): Promise<boolean> {
  const kind = inviteKindForTemplate(key);
  return kind ? isInviteEmailEnabled(kind, organizationId, db) : true;
}
