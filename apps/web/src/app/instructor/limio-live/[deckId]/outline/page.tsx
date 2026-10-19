import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { requireFeature } from "@/lib/session";
import { resolveDeckLanguage } from "@/lib/limioLiveLanguageServer";
import { LiveLangProvider } from "../../liveLangContext";
import OutlineEditor from "./OutlineEditor";

export const metadata = {
  title: "Dàn ý bài giảng | Limio",
};

export default async function OutlinePage({ params }: { params: { deckId: string } }) {
  const userId = await requireFeature("limio_live.access");
  if (!userId) redirect("/instructor/dashboard?blocked=limio_live");
  const deck = await prisma.liveDeck.findFirst({
    where: { id: params.deckId, userId },
    select: { id: true, outline: true },
  });
  if (!deck || !deck.outline) notFound();
  // Ngôn ngữ của bài: tên phần mới và chữ hệ thống trên bản xem trước (docs/tieu-chi/ngon-ngu-slide.md).
  const lang = await resolveDeckLanguage(deck.id);
  return (
    <LiveLangProvider lang={lang}>
      <OutlineEditor deckId={deck.id} />
    </LiveLangProvider>
  );
}
