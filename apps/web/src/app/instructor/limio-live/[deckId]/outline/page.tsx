import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { requireFeature } from "@/lib/session";
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
  return <OutlineEditor deckId={deck.id} />;
}
