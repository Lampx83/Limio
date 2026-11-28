import { redirect } from "next/navigation";
import { isAdmin } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import PlansEditor from "./PlansEditor";
import AdminSectionTabs from "../_components/AdminSectionTabs";

export const dynamic = "force-dynamic";

export default async function AdminPlansPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/signin?next=/admin/plans");
  if (!(await isAdmin(userId))) redirect("/");

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 lg:px-6">
      <AdminSectionTabs section="commerce" />
      <h1 className="text-h1">Gói tài khoản</h1>
      <p className="mt-1 text-meta">
        Sửa quyền lợi và giá của từng gói. Việc gán gói cho tổ chức hoặc người dùng làm ở trang chi tiết của họ.
      </p>
      <PlansEditor />
    </main>
  );
}
