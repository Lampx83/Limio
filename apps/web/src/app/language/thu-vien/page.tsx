import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { listLibrary } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { ROLE_DEFAULT_PATH, getActiveRole } from "@/lib/active-role";
import { isLearnerRole } from "@/lib/learnerRole";
import { getPaymentEnabled } from "@/lib/site-settings";
import { NOINDEX } from "@/lib/seo";
import LibraryView from "@/components/language/LibraryView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Thư viện giáo trình — Limio Language", ...NOINDEX };

/**
 * LANG đợt 2 — Thư viện giáo trình. Chưa đăng nhập → đăng nhập; giảng viên/admin → trang chủ của họ (như `/language`).
 * Chỉ ĐỌC; thẻ không cấp quyền học (ghi danh/mua đi qua `/catalog/[slug]`).
 */
export default async function LibraryPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/signin?callbackUrl=/language/thu-vien");
  const activeRole = getActiveRole(session.user.roles ?? []);
  if (!isLearnerRole(activeRole)) redirect(ROLE_DEFAULT_PATH[activeRole] ?? "/instructor/dashboard");

  const [data, paymentEnabled] = await Promise.all([listLibrary(userId, searchParams), getPaymentEnabled().catch(() => false)]);
  return <LibraryView data={data} paymentEnabled={paymentEnabled} />;
}
