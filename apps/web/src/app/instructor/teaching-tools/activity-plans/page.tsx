import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import ActivityPlanList from "./ActivityPlanList";

export const metadata = {
  title: "Kịch bản lớp học | FeedBackMe",
  description: "Thư viện kịch bản hoạt động tương tác cho 1 tiết học",
};

export default async function ActivityPlansPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  return (
    <main className="space-y-8">
      <div className="border-b border-token pb-6">
        <div className="flex items-center justify-between">
          <Link
            href="/instructor/teaching-tools"
            className="mb-2 inline-block text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            ← Công cụ giảng dạy
          </Link>
          <Link
            href="/instructor/teaching-tools/activity-plans/market"
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Chợ kịch bản →
          </Link>
        </div>
        <h1 className="text-2xl font-bold">Kịch bản lớp học</h1>
        <p className="mt-2 text-muted">
          Thư viện kịch bản của riêng bạn — soạn trước chuỗi hoạt động tương tác cho 1 tiết,
          lên lớp thì chạy sự kiện nào tuỳ ý, không ép theo thứ tự.
        </p>
      </div>

      <ActivityPlanList />
    </main>
  );
}
