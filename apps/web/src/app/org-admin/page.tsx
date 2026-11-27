import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getManagedKinds } from "@/lib/orgAdminOrgs";

export const dynamic = "force-dynamic";

/** Cửa vào "Quản trị đơn vị": trung tâm vào Tổng quan, trường học thông thường vào Thành viên. (Trước đây /org-admin không có trang, báo 404.) */
export default async function OrgAdminHome({ searchParams }: { searchParams: { truong?: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/org-admin");
  const q = searchParams.truong ? `?truong=${encodeURIComponent(searchParams.truong)}` : "";
  const kinds = await getManagedKinds(session.user.id);
  // Trung tâm vào Tổng quan; nhà xuất bản vào Báo cáo; trường thường vào Thành viên.
  redirect(kinds.includes("center") ? `/org-admin/tong-quan${q}` : kinds.includes("publisher") && !kinds.includes("school") ? `/org-admin/bao-cao${q}` : "/org-admin/members");
}
