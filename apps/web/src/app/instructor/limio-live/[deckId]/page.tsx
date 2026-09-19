import { redirect } from "next/navigation";
import { requireFeature } from "@/lib/session";
import LiveDeckEditor from "./LiveDeckEditor";

export const metadata = {
  title: "Soạn bài giảng | FeedBackMe",
};

export default async function LiveDeckEditorPage({
  params,
}: {
  params: { deckId: string };
}) {
  const userId = await requireFeature("limio_live.access");
  if (!userId) redirect("/instructor/dashboard?blocked=limio_live");

  // LiveDeckEditor tự vẽ header riêng (breadcrumb + nút Trình chiếu) và chiếm
  // full chiều cao 3 cột (rail trái/phải + preview giữa) — không bọc thêm
  // <main>/space-y ở đây kẻo lệch layout.
  return <LiveDeckEditor deckId={params.deckId} />;
}
