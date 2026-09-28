import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import { isAnyOrgAdmin } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import OrgAdminSidebar from "./_components/OrgAdminSidebar";

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

  return (
    <div className="flex w-full">
      <OrgAdminSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6">
          {children}
        </div>
      </div>
    </div>
  );
}
