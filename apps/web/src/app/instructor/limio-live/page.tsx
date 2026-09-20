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
        <h1 className="text-2xl font-bold">Limio-Live</h1>
        <p className="mt-2 text-muted">
          Bộ công cụ dạy học trực tiếp trên lớp: soạn bài giảng tương tác, tạo hoạt động nhanh (vote, word cloud, Padlet,
          whiteboard) và điều hành lớp học (đếm ngược, gọi tên, phân nhóm, gameshow). Sinh viên tham gia ngay bằng điện thoại.
        </p>
      </div>

      <LiveDeckList />
    </main>
  );
}
