import { prisma } from "@feedbackme/db";
import { getOrganizationSpaceAdminData, isAdmin, OrgSpaceError } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { bundleAllowedForOrg, normalizeStored } from "@/lib/space/settings";
import { isBlankSpace, templateForKind } from "@/lib/space/templates";
import SpaceSettingsManager from "./SpaceSettingsManager";

/** Mục "Space" trong trang quản trị trường — dùng ở /org-admin/settings và /admin/orgs/[id]. */
export default async function SpaceSettingsSection({ organizationId }: { organizationId: string }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  try {
    const [data, platformAdmin] = await Promise.all([getOrganizationSpaceAdminData(userId, organizationId), isAdmin(userId)]);
    // Combo có thể đưa lên space: mọi khoá trong combo thuộc trường này hoặc chưa có chủ (cùng quy tắc lúc hiển thị).
    const bundleRows = await prisma.courseBundle.findMany({
      orderBy: { title: "asc" },
      take: 200,
      select: { slug: true, title: true, status: true, items: { select: { course: { select: { organizationId: true } } } } },
    });
    const orgBundles = bundleRows
      .filter((b) => bundleAllowedForOrg(b.items.map((i) => i.course.organizationId), organizationId))
      .map((b) => ({ slug: b.slug, title: b.title, status: b.status }));
    // Space chưa từng cấu hình: form mở sẵn mẫu theo loại tổ chức (chưa lưu gì cho tới khi bấm Lưu). Đã có cấu hình thì giữ nguyên.
    const stored = normalizeStored(data.space);
    const initial = isBlankSpace(stored) ? templateForKind(data.kind, data.name) : stored;
    return (
      <SpaceSettingsManager
        organizationId={organizationId}
        orgName={data.name}
        orgCourses={data.courses}
        orgBundles={orgBundles}
        orgKind={data.kind}
        initial={initial}
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
