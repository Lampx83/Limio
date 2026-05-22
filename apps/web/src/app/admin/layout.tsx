import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import { isAdmin } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import AdminSidebar from "./_components/AdminSidebar";
import ExitImpersonationButton from "@/components/ExitImpersonationButton";

// Không set `dynamic = "force-dynamic"` ở layout này để mỗi page con tự
// chọn chiến lược cache (vd. trang config có thể ISR 30s). Layout vẫn
// chạy động vì gọi auth() — đọc cookie là dynamic source.

// Admin role rất hiếm khi đổi → cache 60s per userId để mọi navigation
// trong khu vực admin không phải chạy lại isAdmin().
const getIsAdminCached = unstable_cache(
  async (userId: string) => isAdmin(userId),
  ["admin-layout-is-admin"],
  { revalidate: 60, tags: ["user-roles"] },
);

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/admin/dashboard");

  // If admin is impersonating, session.user.id is the *target* — they won't
  // pass isAdmin(). Show an explicit "you're impersonating" prompt instead of
  // the generic so the way out is obvious.
  const impersonator = session.user.impersonator;
  if (impersonator) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-2xl border border-warning-200 bg-warning-50 p-6 text-warning-900">
          <h1 className="h-display text-xl font-bold">
            Đang xem dưới vai trò {session.user.name ?? session.user.email}
          </h1>
          <p className="mt-2 text-sm">
            Khu vực admin chỉ truy cập bằng tài khoản admin thật. Bạn đang xem
            ứng dụng dưới vai trò một người dùng khác.
          </p>
          <div className="mt-4">
            <ExitImpersonationButton />
          </div>
        </div>
      </main>
    );
  }

  if (!(await getIsAdminCached(session.user.id))) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-2xl border border-danger-100 bg-danger-50 p-5 text-sm text-danger-700">
          Chỉ admin mới truy cập được.
        </div>
      </main>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-6 lg:px-6">
      <AdminSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
