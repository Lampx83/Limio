import { unstable_cache } from "next/cache";
import { prisma } from "@feedbackme/db";
import { isAdmin, type OrgKind } from "@feedbackme/core-lms";

/**
 * Các trung tâm (loại "center") mà người này quản trị (Platform Admin thấy mọi trường như vậy).
 * Dùng chung cho các trang `/org-admin` của trung tâm (điều phối lịch, lớp và giáo viên).
 */
export async function listManagedCenterOrgs(userId: string): Promise<{ orgs: Array<{ id: string; name: string }>; platform: boolean; anyAdminship: boolean }> {
  const platform = await isAdmin(userId);
  const orgs = platform
    ? await prisma.organization.findMany({ where: { kind: "center" }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    : (
        await prisma.organizationAdmin.findMany({
          where: { userId, organization: { kind: "center" } },
          select: { organization: { select: { id: true, name: true } } },
        })
      )
        .map((a) => a.organization)
        .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  const anyAdminship = !platform && orgs.length === 0 ? (await prisma.organizationAdmin.count({ where: { userId } })) > 0 : false;
  return { orgs, platform, anyAdminship };
}

/** Mọi trường người này quản trị (Platform Admin thấy mọi trường), bật tính năng trung tâm hay không: cho các việc quản trị chung như lớp và giáo viên. */
export async function listManagedOrgs(userId: string): Promise<Array<{ id: string; name: string }>> {
  if (await isAdmin(userId)) return prisma.organization.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  return (await prisma.organizationAdmin.findMany({ where: { userId }, select: { organization: { select: { id: true, name: true } } } }))
    .map((a) => a.organization)
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

/**
 * Các loại tổ chức người này quản trị (Platform Admin: mọi loại đang có). Quyết định menu quản trị hiện nhóm nào: trung tâm có nhóm
 * "Trung tâm", nhà xuất bản có nhóm "Nhà xuất bản", trường thường chỉ có phần chung.
 */
export async function getManagedKinds(userId: string): Promise<OrgKind[]> {
  const rows = (await isAdmin(userId))
    ? await prisma.organization.findMany({ distinct: ["kind"], select: { kind: true } })
    : (await prisma.organizationAdmin.findMany({ where: { userId }, select: { organization: { select: { kind: true } } } })).map((a) => a.organization);
  return [...new Set(rows.map((r) => r.kind))].sort() as OrgKind[];
}

// Menu quản trị render ở mọi lượt chuyển trang: cache ngắn theo người dùng. Gắn thẻ "center-access" để đổi loại áp ngay.
export const getManagedKindsCached = unstable_cache(
  async (userId: string) => getManagedKinds(userId),
  ["org-admin-managed-kinds"],
  { revalidate: 60, tags: ["user-roles", "center-access"] },
);

/**
 * Các loại tổ chức người này được GÁN quản trị (khác `getManagedKinds`: không tính quyền của Platform Admin). Dùng cho nhãn "Admin trung tâm",
 * "Admin trường", "Admin NXB" ở menu tài khoản.
 */
export const getOwnAdminKindsCached = unstable_cache(
  async (userId: string): Promise<OrgKind[]> => {
    const rows = await prisma.organizationAdmin.findMany({ where: { userId }, select: { organization: { select: { kind: true } } } });
    return [...new Set(rows.map((r) => r.organization.kind))].sort() as OrgKind[];
  },
  ["header-own-admin-kinds"],
  { revalidate: 60, tags: ["user-roles", "center-access"] },
);
