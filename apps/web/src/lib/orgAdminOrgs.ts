import { prisma } from "@feedbackme/db";
import { isAdmin } from "@feedbackme/core-lms";

/**
 * Các trường đã bật tính năng trung tâm mà người này quản trị (Platform Admin thấy mọi trường như vậy).
 * Dùng chung cho các trang `/org-admin` của trung tâm (điều phối lịch, lớp và giáo viên).
 */
export async function listManagedCenterOrgs(userId: string): Promise<{ orgs: Array<{ id: string; name: string }>; platform: boolean; anyAdminship: boolean }> {
  const platform = await isAdmin(userId);
  const orgs = platform
    ? await prisma.organization.findMany({ where: { centerEnabled: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    : (
        await prisma.organizationAdmin.findMany({
          where: { userId, organization: { centerEnabled: true } },
          select: { organization: { select: { id: true, name: true } } },
        })
      )
        .map((a) => a.organization)
        .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  const anyAdminship = !platform && orgs.length === 0 ? (await prisma.organizationAdmin.count({ where: { userId } })) > 0 : false;
  return { orgs, platform, anyAdminship };
}
