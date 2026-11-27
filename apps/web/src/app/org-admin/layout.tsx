import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import { isAdmin, isAnyOrgAdmin, listEnterableOrgs } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { getActiveOrg } from "@/lib/activeOrg";
import OrgAdminSidebar from "./_components/OrgAdminSidebar";
import OrgPicker from "./_components/OrgPicker";

// OrgAdmin role hiếm khi đổi → cache 60s per userId, giống admin/layout.tsx.
const getIsAnyOrgAdminCached = unstable_cache(
  async (userId: string) => isAnyOrgAdmin(userId),
  ["org-admin-layout-is-any-org-admin"],
  { revalidate: 60, tags: ["user-roles"] },
);

export default async function OrgAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/org-admin/settings");

  if (!(await getIsAnyOrgAdminCached(session.user.id))) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-2xl border border-danger-100 bg-danger-50 p-5 text-sm text-danger-700">
          Chỉ quản trị viên trường (OrgAdmin) mới truy cập được.
        </div>
      </main>
    );
  }

  // Phải chọn một tổ chức rồi mới vào (Platform Admin: bắt buộc, mỗi lần chọn ghi nhật ký; OrgAdmin: mặc định tổ chức được gán đầu tiên).
  const [active, platform] = await Promise.all([getActiveOrg(session.user.id), isAdmin(session.user.id)]);
  if (!active) {
    const orgs = await listEnterableOrgs(session.user.id);
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-10 lg:px-6">
        <OrgPicker orgs={orgs} platform={platform} />
      </main>
    );
  }
  // Có quyền vào nhiều hơn một tổ chức thì menu có nút "Đổi tổ chức".
  const canSwitch = platform || (await listEnterableOrgs(session.user.id)).length > 1;

  return (
    <div className="flex w-full">
      <OrgAdminSidebar kinds={[active.kind]} orgName={active.name} canSwitch={canSwitch} />
      <div className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6">
          {children}
        </div>
      </div>
    </div>
  );
}
