import { notFound, redirect } from "next/navigation";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import { getLiveDeck } from "@feedbackme/core-lms";
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
  const deck = await getLiveDeck(params.deckId, userId, prisma);
  if (!deck) notFound();
  // JSON round-trip: Date → chuỗi ISO, khớp đúng hình dạng API trả về.
  return <LiveDeckEditor deckId={params.deckId} initialDeck={JSON.parse(JSON.stringify(deck))} />;
}
