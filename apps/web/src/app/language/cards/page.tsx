import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLanguageLearnerOverview } from "@feedbackme/core-lms";
import { getFlashcardStats } from "@feedbackme/core-feedback";
import { auth } from "@/lib/auth";
import { NOINDEX } from "@/lib/seo";
import EmptyState from "@/components/ui/EmptyState";
import PageFrame from "@/components/language/PageFrame";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Thẻ ôn từ — Limio Language", ...NOINDEX };

export default async function LanguageCards() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/language/cards");
  const o = await getLanguageLearnerOverview(session.user.id);
  const rows = await Promise.all(
    o.courses.map(async (c) => ({ c, s: await getFlashcardStats(session.user.id, c.id).catch(() => null) })),
  );
  return (
    <PageFrame title="Thẻ ôn từ" description="Ôn lại từ vựng theo lịch nhắc lại — chọn khoá để vào bộ thẻ.">
      {rows.length === 0 ? (
        <EmptyState title="Chưa có bộ thẻ nào" description="Thẻ tạo từ các bài từ vựng của khoá ngoại ngữ bạn đang học." />
      ) : (
        <ul className="divide-y divide-[rgb(var(--border))] rounded-xl border border-token bg-[rgb(var(--surface))]">
          {rows.map(({ c, s }) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <div className="font-medium">{c.title}</div>
                <div className="text-caption text-muted">{s ? `${s.dueToday} thẻ cần ôn hôm nay · ${s.total} thẻ` : "Chưa có thẻ"}</div>
              </div>
              <Link href={`/learn/${c.slug}/flashcards`} className="btn-primary btn-sm">Vào ôn</Link>
            </li>
          ))}
        </ul>
      )}
    </PageFrame>
  );
}
