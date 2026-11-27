import { cache } from "react";
import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";
import { prisma } from "@feedbackme/db";
import { canEnterOrg, isAdmin, type OrgKind } from "@feedbackme/core-lms";

/**
 * Tổ chức đang chọn của khu quản trị đơn vị (docs/tieu-chi/chon-to-chuc-khi-vao-quan-tri.md).
 * Cookie chỉ NHỚ lựa chọn; quyền luôn kiểm lại ở đây (`canEnterOrg`), nên cookie giả hay cũ không mở thêm quyền.
 * Việc ghi nhật ký mỗi lần vào nằm ở `enterOrgAdminWorkspace` (route `/api/org-admin/active-org`), không phải ở đây.
 */
export const ACTIVE_ORG_COOKIE = "fbm_org";

export interface ActiveOrg {
  id: string;
  name: string;
  code: string;
  kind: OrgKind;
}

/**
 * Menu và trang gọi ở MỌI lượt chuyển trang, nên cache ngắn theo (người, tổ chức đã nhớ). Đổi loại tổ chức hay gỡ quyền áp trong ≤ 60 giây,
 * hoặc ngay khi gọi `revalidateTag("center-access")`; quyền thật vẫn do từng hàm lõi kiểm khi đọc dữ liệu.
 */
const resolveActiveOrg = unstable_cache(
  async (userId: string, rememberedId: string | null): Promise<ActiveOrg | null> => {
    const pick = { id: true, name: true, code: true, kind: true } as const;
    if (rememberedId && (await canEnterOrg(userId, rememberedId))) {
      const org = await prisma.organization.findUnique({ where: { id: rememberedId }, select: pick });
      if (org) return { ...org, kind: org.kind as OrgKind };
    }
    // Chưa chọn (hoặc lựa chọn cũ không còn quyền): OrgAdmin được gán thì vào tổ chức đầu tiên theo tên.
    // Platform Admin thì KHÔNG tự vào tổ chức nào: phải chọn, và mỗi lần chọn được ghi nhật ký.
    if (await isAdmin(userId)) return null;
    const first = await prisma.organizationAdmin.findFirst({ where: { userId }, select: { organization: { select: pick } }, orderBy: { organization: { name: "asc" } } });
    return first ? { ...first.organization, kind: first.organization.kind as OrgKind } : null;
  },
  ["active-org"],
  { revalidate: 60, tags: ["user-roles", "center-access", "active-org"] },
);

/** Tổ chức đang chọn của người này, null nếu chưa chọn (Platform Admin) hoặc không quản trị tổ chức nào. */
export const getActiveOrg = cache(async (userId: string): Promise<ActiveOrg | null> => {
  const remembered = cookies().get(ACTIVE_ORG_COOKIE)?.value ?? null;
  return resolveActiveOrg(userId, remembered);
});

export async function getActiveOrgId(userId: string): Promise<string | null> {
  return (await getActiveOrg(userId))?.id ?? null;
}

/**
 * Dạng "danh sách quản trị" mà các trang quản trị đơn vị vẫn dùng (`adminships[0]`), nhưng chỉ gồm tổ chức đang chọn và đọc từ bảng tổ chức,
 * nên Platform Admin (không có dòng quản trị nào) cũng dùng được. Rỗng nếu chưa chọn tổ chức nào.
 */
export async function activeAdminships<S extends Record<string, true | object>>(userId: string, select: S) {
  const id = await getActiveOrgId(userId);
  if (!id) return [];
  const rows = await prisma.organization.findMany({ where: { id }, select: { ...select, id: true } });
  return rows.map((organization) => ({ organizationId: id, organization }));
}
