import { redirect } from "next/navigation";
import { requireFeature } from "@/lib/session";
import LiveDeckList from "./LiveDeckList";

export const metadata = {
  title: "Limio-Live | FeedBackMe",
  description: "Soạn và trình chiếu bài giảng tương tác kiểu Nearpod",
};

export default async function LimioLivePage() {
  const userId = await requireFeature("limio_live.access");
  if (!userId) redirect("/instructor/dashboard?blocked=limio_live");

  return (
    <main className="space-y-8">
      <div className="border-b border-token pb-6">
        <h1 className="bg-gradient-to-r from-pink-600 via-rose-500 to-orange-500 bg-clip-text text-3xl font-bold text-transparent">
          Limio-Live
        </h1>
        <p className="mt-2 text-muted">
          Bài giảng của riêng bạn — trộn slide trình bày (văn bản, video, PDF...) với slide tương tác (trắc nghiệm, thăm dò,
          word cloud, bảng cộng tác) rồi trình chiếu tuần tự trên lớp.
        </p>
      </div>

      <LiveDeckList />
    </main>
  );
}
