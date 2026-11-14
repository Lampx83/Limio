import { getOrganizationSpaceAdminData, isAdmin, OrgSpaceError } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { normalizeStored } from "@/lib/space/settings";
import SpaceSettingsManager from "./SpaceSettingsManager";

/** Mục "Space" trong trang quản trị trường — dùng ở /org-admin/settings và /admin/orgs/[id]. */
export default async function SpaceSettingsSection({ organizationId }: { organizationId: string }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  try {
    const [data, platformAdmin] = await Promise.all([getOrganizationSpaceAdminData(userId, organizationId), isAdmin(userId)]);
    return (
      <SpaceSettingsManager
        organizationId={organizationId}
        orgName={data.name}
        orgCourses={data.courses}
        initial={normalizeStored(data.space)}
        initialEnabled={data.spaceEnabled}
        initialSlug={data.spaceSlug}
        isPlatformAdmin={platformAdmin}
      />
    );
  } catch (e) {
    if (e instanceof OrgSpaceError) return null; // không có quyền / không thấy trường: ẩn mục
    throw e;
  }
}
