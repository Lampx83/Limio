/**
 * Báo cáo nhà xuất bản (docs/tieu-chi/bao-cao-nha-xuat-ban.md). Trang chỉ đọc: phát hành, doanh thu,
 * người học (ẩn danh), học liệu. Ai được xem: xem core-lms/src/reports/access.ts.
 * Quản trị nhà xuất bản dùng bản nằm trong khu quản trị: /org-admin/bao-cao.
 */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import PublisherReportView from "@/components/report/PublisherReportView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Báo cáo nhà xuất bản" };

export default async function PublisherReportPage({
  searchParams,
}: {
  searchParams: { course?: string; range?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/bao-cao");
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:py-10">
      <PublisherReportView userId={session.user.id} basePath="/bao-cao" searchParams={searchParams} />
    </main>
  );
}
