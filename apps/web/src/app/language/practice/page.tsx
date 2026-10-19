import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLanguageLearnerOverview, listMockExamsForLearner } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { NOINDEX } from "@/lib/seo";
import EmptyState from "@/components/ui/EmptyState";
import PageFrame from "@/components/language/PageFrame";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Luyện thi — Limio Language", ...NOINDEX };

/** Tạm thời: gộp đề đang mở của các khoá ngoại ngữ. Thư viện đề có lọc/phân trang là L6. */
export default async function LanguagePractice() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/language/practice");
  const o = await getLanguageLearnerOverview(session.user.id);
  const banks = o.courses.filter((c) => c.kind === "practice_bank");
  const groups = (
    await Promise.all(
      o.courses.filter((c) => c.kind !== "practice_bank" && c.openExamCount > 0).map(async (c) => ({ c, exams: await listMockExamsForLearner(session.user.id, c.id).catch(() => []) })),
    )
  ).filter((g) => g.exams.length > 0);
  return (
    <PageFrame title="Luyện thi" description="Luyện đề không giới hạn thời gian, hoặc vào phòng thi mô phỏng bấm giờ.">
      {banks.length > 0 && (
        <section aria-label="Khoá luyện đề">
          <h2 className="text-h3">Khoá luyện đề của bạn</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {banks.map((b) => (
              <li key={b.id} className="rounded-xl border border-token bg-[rgb(var(--surface))] p-4">
                <div className="font-medium">{b.title}</div>
                <div className="text-caption mt-1 text-muted">{b.openExamCount} đề</div>
                <Link href={`/learn/${b.slug}/practice`} className="btn-primary btn-sm mt-3 inline-block">Vào thư viện đề</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-meta">
        Chưa có khoá luyện đề phù hợp? <Link href="/catalog" className="link">Xem catalog khoá học</Link>.
      </p>
      {groups.length === 0 ? (
        banks.length === 0 ? <EmptyState title="Chưa có đề nào đang mở" description="Khi giảng viên mở đề luyện/thi thử trong khoá của bạn, đề sẽ hiện ở đây." /> : null
      ) : (
        groups.map(({ c, exams }) => (
          <section key={c.id} aria-label={c.title}>
            <h2 className="text-h3">{c.title}</h2>
            <ul className="mt-3 divide-y divide-[rgb(var(--border))] rounded-xl border border-token bg-[rgb(var(--surface))]">
              {exams.map((e) => (
                <li key={e.examId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <div className="font-medium">{e.title}</div>
                    <div className="text-caption text-muted">{e.sections.map((s) => s.title).join(" · ")} · {e.totalMinutes} phút</div>
                  </div>
                  <Link href={`/learn/${c.slug}/exams/${e.examId}`} className="btn-primary btn-sm">Mở</Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </PageFrame>
  );
}
