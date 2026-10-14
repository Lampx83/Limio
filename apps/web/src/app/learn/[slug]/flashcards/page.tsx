import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { isUserEnrolled } from "@feedbackme/core-lms";
import { getFlashcardQueue, type FlashcardQueueReason } from "@feedbackme/core-feedback";
import {
  FLASHCARD_MODES,
  FLASHCARD_MODE_LABEL,
  isFlashcardMode,
} from "@feedbackme/shared-types";
import { auth } from "@/lib/auth";
import EmptyState from "@/components/ui/EmptyState";
import FlashcardSession from "@/components/FlashcardSession";

export const dynamic = "force-dynamic";

const EMPTY_TEXT: Record<FlashcardQueueReason, string> = {
  not_enrolled: "Bạn cần ghi danh khoá học để ôn từ vựng.",
  empty_deck: "Khoá học này chưa có bảng từ vựng nào.",
  no_audio_cards: "Chưa có từ nào kèm audio để luyện nghe. Hãy chọn chế độ khác.",
  all_done: "Hôm nay bạn đã ôn xong. Quay lại vào ngày mai nhé.",
};

/**
 * LANG G4 — ôn flashcard từ vựng của chính học viên đang đăng nhập. Không nhận userId
 * từ URL. Chế độ hỏi đi qua `?mode=`; đổi chế độ là tải lại phiên từ máy chủ.
 */
export default async function FlashcardsPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: { mode?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect(`/signin?callbackUrl=/learn/${params.slug}/flashcards`);
  const userId = session.user.id;

  const course = await prisma.course.findUnique({
    where: { slug: params.slug },
    select: { id: true, title: true },
  });
  if (!course) notFound();
  if (!(await isUserEnrolled(userId, course.id))) redirect(`/catalog/${params.slug}?locked=1`);

  const mode = isFlashcardMode(searchParams?.mode) ? searchParams.mode : "term_to_meaning";
  const queue = await getFlashcardQueue(userId, course.id, { mode });

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 lg:px-6">
      <Link href={`/learn/${params.slug}`} className="link inline-flex items-center gap-1 text-sm">
        ← {course.title}
      </Link>
      <h1 className="text-h1 mt-3">Ôn từ vựng</h1>

      <nav aria-label="Chế độ ôn" className="mt-4 flex flex-wrap gap-2">
        {FLASHCARD_MODES.map((m) => (
          <Link
            key={m}
            href={`/learn/${params.slug}/flashcards?mode=${m}`}
            aria-current={m === mode ? "page" : undefined}
            className={`rounded-lg border px-3 py-1 text-sm ${
              m === mode ? "border-brand-200 bg-brand-soft text-brand-700" : "border-token hover:bg-brand-soft"
            }`}
          >
            {FLASHCARD_MODE_LABEL[m]}
          </Link>
        ))}
      </nav>

      <div className="mt-6">
        {queue.cards.length > 0 ? (
          <FlashcardSession
            key={queue.cards.map((c) => c.itemId).join(",")}
            courseId={course.id}
            slug={params.slug}
            mode={mode}
            initialCards={queue.cards}
          />
        ) : (
          <EmptyState title="Ôn từ vựng" description={EMPTY_TEXT[queue.reason ?? "all_done"]} />
        )}
      </div>
    </main>
  );
}
