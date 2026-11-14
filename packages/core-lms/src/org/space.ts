/**
 * SPACE của trường: trang riêng /s/<slug> + nhận diện thương hiệu (màu, logo, chữ, danh sách khoá).
 * Cấu hình lưu ở Organization.space (JSON đã được tầng web chuẩn hoá); module này lo quyền, slug và ranh giới khoá.
 * Platform Admin hoặc OrgAdmin của chính trường được sửa; slug của space dựng sẵn chỉ Platform Admin dùng.
 */
import { isBuiltinSpaceSlug, isValidSpaceSlug } from "@feedbackme/shared-types";
import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { isAdmin, isOrgAdminOf } from "../auth/roles";
import { logAudit } from "../auth/audit";

export class OrgSpaceError extends Error {
  constructor(
    public readonly code: "forbidden" | "org_not_found" | "invalid_slug" | "slug_required" | "slug_taken" | "slug_reserved" | "course_not_in_org",
    public readonly details?: unknown,
  ) {
    super(code);
    this.name = "OrgSpaceError";
  }
}

export interface OrgSpaceAdminData {
  id: string;
  name: string;
  code: string;
  brandingLogoUrl: string | null;
  spaceEnabled: boolean;
  spaceSlug: string | null;
  space: unknown;
  /** Khoá của trường — để chọn đưa vào space. */
  courses: Array<{ slug: string; title: string; status: string }>;
}

async function assertCanManage(actorUserId: string, organizationId: string, db: PrismaClient): Promise<void> {
  if (!(await isOrgAdminOf(actorUserId, organizationId, db))) throw new OrgSpaceError("forbidden");
}

export async function getOrganizationSpaceAdminData(
  actorUserId: string,
  organizationId: string,
  db: PrismaClient = prisma,
): Promise<OrgSpaceAdminData> {
  // Phân quyền trước để người ngoài không dò được trường nào tồn tại.
  await assertCanManage(actorUserId, organizationId, db);
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      code: true,
      brandingLogoUrl: true,
      spaceEnabled: true,
      spaceSlug: true,
      space: true,
      courses: { select: { slug: true, title: true, status: true }, orderBy: { title: "asc" }, take: 500 },
    },
  });
  if (!org) throw new OrgSpaceError("org_not_found");
  return org;
}

export interface UpdateOrgSpaceInput {
  spaceEnabled: boolean;
  spaceSlug: string | null;
  /** JSON đã chuẩn hoá bởi apps/web/src/lib/space/settings.ts (normalizeStored). */
  space: object;
}

export async function updateOrganizationSpace(
  actorUserId: string,
  organizationId: string,
  input: UpdateOrgSpaceInput,
  db: PrismaClient = prisma,
): Promise<{ spaceEnabled: boolean; spaceSlug: string | null }> {
  await assertCanManage(actorUserId, organizationId, db);
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, spaceEnabled: true, spaceSlug: true },
  });
  if (!org) throw new OrgSpaceError("org_not_found");
  const platformAdmin = await isAdmin(actorUserId, db);

  const slug = input.spaceSlug?.trim() || null;
  if (slug !== null && !isValidSpaceSlug(slug)) throw new OrgSpaceError("invalid_slug");
  if (input.spaceEnabled && slug === null) throw new OrgSpaceError("slug_required");
  if (slug !== null && slug !== org.spaceSlug && isBuiltinSpaceSlug(slug) && !platformAdmin) {
    throw new OrgSpaceError("slug_reserved");
  }
  if (slug !== null) {
    const taken = await db.organization.findFirst({
      where: { spaceSlug: slug, NOT: { id: organizationId } },
      select: { id: true },
    });
    if (taken) throw new OrgSpaceError("slug_taken");
  }

  // Một OrgAdmin không được gắn thương hiệu của mình lên khoá của trường khác (hay khoá chưa có chủ). Khoá chưa tồn tại
  // thì được giữ chỗ ("sắp ra mắt"); Platform Admin không bị giới hạn.
  const courseSlugs = ((input.space as { courses?: Array<{ slug: string }> }).courses ?? []).map((c) => c.slug);
  if (!platformAdmin && courseSlugs.length > 0) {
    const existing = await db.course.findMany({
      where: { slug: { in: courseSlugs } },
      select: { slug: true, organizationId: true },
    });
    const foreign = existing.filter((c) => c.organizationId !== organizationId).map((c) => c.slug);
    if (foreign.length > 0) throw new OrgSpaceError("course_not_in_org", { slugs: foreign });
  }

  await db.$transaction(async (tx) => {
    await tx.organization.update({
      where: { id: organizationId },
      data: {
        spaceEnabled: input.spaceEnabled,
        spaceSlug: slug,
        space: input.space as Prisma.InputJsonValue,
      },
    });
    await logAudit(
      {
        action: "org.space_changed",
        actorUserId,
        payload: {
          organizationId,
          from: { enabled: org.spaceEnabled, slug: org.spaceSlug },
          to: { enabled: input.spaceEnabled, slug },
          courseCount: courseSlugs.length,
        },
      },
      tx,
    );
  });
  return { spaceEnabled: input.spaceEnabled, spaceSlug: slug };
}
