import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireFeature } from "@/lib/session";
import PresentDeck from "./PresentDeck";

export const metadata = {
  title: "Trình chiếu | FeedBackMe",
};

export default async function LiveDeckPresentPage({
  params,
}: {
  params: { deckId: string };
}) {
  const userId = await requireFeature("limio_live.access");
  if (!userId) redirect("/instructor/dashboard?blocked=limio_live");

  // PresentDeck đọc ?view=audience qua useSearchParams — App Router bắt buộc
  // bọc Suspense cho client component dùng hook này.
  return (
    <Suspense fallback={null}>
      <PresentDeck deckId={params.deckId} />
    </Suspense>
  );
}
