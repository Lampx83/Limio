import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import { getLiveDeck, listLiveSessionHistory } from "@feedbackme/core-lms";
import DateTime from "@/components/ui/DateTime";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";

export const metadata = {
  title: "Lịch sử tương tác | Limio",
};

export default async function LiveDeckHistoryPage({
  params,
}: {
  params: { deckId: string };
}) {
  const userId = await requireFeature("limio_live.access");
  if (!userId) redirect("/instructor/dashboard?blocked=limio_live");

  const deck = await getLiveDeck(params.deckId, userId, prisma);
  if (!deck) notFound();

  const sessions = await listLiveSessionHistory(params.deckId, userId, prisma);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <div className="border-b border-token pb-4">
        <Link href={`/instructor/limio-live/${params.deckId}`} className="text-sm text-muted hover:text-brand-600">
          ← Về bài giảng
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Lịch sử tương tác</h1>
        <p className="mt-1 text-muted">
          {deck.title} · Mỗi lần trình chiếu là một lượt riêng, với kết quả vote, word cloud, bảng và whiteboard của lượt đó.
        </p>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          title="Chưa có lượt trình chiếu nào"
          description="Khi bạn trình chiếu bài giảng này, kết quả tương tác của từng lượt sẽ được lưu tại đây."
        />
      ) : (
        <ul className="space-y-3">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link
                href={`/instructor/limio-live/${params.deckId}/history/${s.id}`}
                className="block rounded-xl border border-token bg-[rgb(var(--surface))] p-4 transition hover:border-brand-400 hover:shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">
                    <DateTime value={s.startedAt.toISOString()} format="datetime" />
                  </span>
                  <StatusBadge tone={s.endedAt ? "neutral" : "success"} pulse={!s.endedAt}>
                    {s.endedAt ? "Đã kết thúc" : "Đang mở"}
                  </StatusBadge>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {s.interactiveCount} slide tương tác · {s.responseCount} lượt phản hồi
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
