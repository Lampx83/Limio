import { notFound, redirect } from "next/navigation";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import { getLiveDeck } from "@feedbackme/core-lms";
import { withOrgBrand } from "@/lib/limioLiveBrandServer";
import { resolveDeckLanguage } from "@/lib/limioLiveLanguageServer";
import LiveDeckEditor from "./LiveDeckEditor";

export const metadata = {
  title: "Soạn bài giảng | Limio",
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
  // Bài cũ chưa có ngôn ngữ: nhận từ nội dung ngay khi mở (docs/tieu-chi/ngon-ngu-slide.md, L4).
  if (!deck.language) deck.language = await resolveDeckLanguage(deck.id);
  // JSON round-trip: Date → chuỗi ISO, khớp đúng hình dạng API trả về.
  return <LiveDeckEditor deckId={params.deckId} initialDeck={JSON.parse(JSON.stringify(await withOrgBrand(deck, userId)))} />;
}
