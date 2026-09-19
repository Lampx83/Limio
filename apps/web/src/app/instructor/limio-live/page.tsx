import { redirect } from "next/navigation";
import { requireFeature } from "@/lib/session";
import LiveDeckList from "./LiveDeckList";

export const metadata = {
  title: "Limio-Live | FeedBackMe",
  description: "Soạn và trình chiếu bài giảng tương tác kiểu Nearpod",
};

export default async function LimioLivePage() {
  const userId = await requireFeature("limio_live.access");
  if (!userId) redirect("/instructor/dashboard");

  return (
    <main className="space-y-8">
      <div className="border-b border-token pb-6">
        <h1 className="text-3xl font-bold">Limio-Live</h1>
        <p className="mt-2 text-muted">
          Bài giảng của riêng bạn — trộn slide nội dung với slide tương tác (trắc nghiệm, thăm dò,
          word cloud, bảng cộng tác) rồi trình chiếu tuần tự trên lớp.
        </p>
      </div>

      <LiveDeckList />
    </main>
  );
}
