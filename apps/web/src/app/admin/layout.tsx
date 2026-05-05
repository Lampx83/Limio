import { redirect } from "next/navigation";
import { isAdmin } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import AdminSidebar from "./_components/AdminSidebar";
import ExitImpersonationButton from "@/components/ExitImpersonationButton";

export const dynamic = "force-dynamic";

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

  if (!(await isAdmin(session.user.id)) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-2xl border border-danger-100 bg-danger-50 p-5 text-sm text-danger-700">
          Chỉ admin mới truy cập được.
        </div>
      </main>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 lg:px-6">
      <AdminSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
