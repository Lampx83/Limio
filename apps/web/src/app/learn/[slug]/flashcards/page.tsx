import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { isUserEnrolled } from "@feedbackme/core-lms";
import { getFlashcardQueue, type FlashcardQueueReason } from "@feedbackme/core-feedback";
import { FLASHCARD_MODES, isFlashcardMode } from "@feedbackme/shared-types";
import { getT } from "@/lib/i18n/server";
import { auth } from "@/lib/auth";
import EmptyState from "@/components/ui/EmptyState";
import FlashcardSession from "@/components/FlashcardSession";

export const dynamic = "force-dynamic";

const EMPTY_KEY = {
  not_enrolled: "learn.flash.empty.not_enrolled",
  empty_deck: "learn.flash.empty.empty_deck",
  no_audio_cards: "learn.flash.empty.no_audio_cards",
  all_done: "learn.flash.empty.all_done",
} as const satisfies Record<FlashcardQueueReason, string>;

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
  const t = await getT();
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
      <h1 className="text-h1 mt-3">{t("learn.flash.title")}</h1>

      <nav aria-label={t("learn.flash.modesAria")} className="mt-4 flex flex-wrap gap-2">
        {FLASHCARD_MODES.map((m) => (
          <Link
            key={m}
            href={`/learn/${params.slug}/flashcards?mode=${m}`}
            aria-current={m === mode ? "page" : undefined}
            className={`rounded-lg border px-3 py-1 text-sm ${
              m === mode ? "border-brand-200 bg-brand-soft text-brand-700" : "border-token hover:bg-brand-soft"
            }`}
          >
            {t(`learn.flash.mode.${m}`)}
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
          <EmptyState title={t("learn.flash.title")} description={t(EMPTY_KEY[queue.reason ?? "all_done"])} />
        )}
      </div>
    </main>
  );
}
