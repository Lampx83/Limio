import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import MarketList from "./MarketList";

export const metadata = {
  title: "Chợ kịch bản | FeedBackMe",
  description: "Kịch bản lớp học công khai từ các giáo viên khác",
};

export default async function ActivityPlanMarketPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  return (
    <main className="space-y-8">
      <div className="border-b border-token pb-6">
        <Link
          href="/instructor/teaching-tools/activity-plans"
          className="mb-2 inline-block text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          ← Kịch bản của tôi
        </Link>
        <h1 className="text-2xl font-bold">Chợ kịch bản</h1>
        <p className="mt-2 text-muted">
          Kịch bản công khai từ các giáo viên khác — lưu lại xem sau, thả tim ủng hộ, hoặc sao chép về thư viện của bạn để sửa.
        </p>
      </div>

      <MarketList />
    </main>
  );
}
