import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLanguageTeacherOverview } from "@feedbackme/core-lms";
import { listPendingAiFeedback } from "@feedbackme/core-feedback";
import { LANGUAGE_SKILL_LABEL } from "@feedbackme/shared-types";
import { auth } from "@/lib/auth";
import { NOINDEX } from "@/lib/seo";
import EmptyState from "@/components/ui/EmptyState";
import PageFrame from "@/components/language/PageFrame";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Chờ duyệt / chấm — Limio Language", ...NOINDEX };

const KIND = { writing: "Viết", speaking: "Nói" } as const;

export default async function LanguageReview() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/language/review");
  // Chỉ giảng viên có khoá ngoại ngữ mới có hàng đợi; người khác thấy trang trống (không lỗi quyền).
  const o = await getLanguageTeacherOverview(session.user.id);
  const ai = await listPendingAiFeedback(o.courses.map((c) => c.id), 30);
  const empty = o.pendingGradeTotal === 0 && ai.length === 0;
  return (
    <PageFrame title="Chờ duyệt / chấm" description="Bài Viết và Nói học viên đã nộp, và góp ý AI đang chờ bạn duyệt.">
      {empty ? (
        <EmptyState title="Không có gì đang chờ" description="Khi học viên nộp bài Viết/Nói hoặc nhờ AI góp ý, chúng hiện ở đây." />
      ) : (
        <>
          <section aria-labelledby="ai-pending">
            <h2 id="ai-pending" className="text-h3">Góp ý AI chờ duyệt ({ai.length})</h2>
            {ai.length === 0 ? (
              <p className="text-meta mt-2">Chưa có góp ý nào chờ duyệt.</p>
            ) : (
              <ul className="mt-3 divide-y divide-[rgb(var(--border))] rounded-xl border border-token bg-[rgb(var(--surface))]">
                {ai.map((a) => (
                  <li key={`${a.kind}-${a.feedbackId}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <span className="min-w-0"><b>{a.studentName}</b> · {a.assignmentTitle} <span className="text-muted">— góp ý {KIND[a.kind]}</span></span>
                    <Link href={`/instructor/assignments/${a.assignmentId}/submissions`} className="btn-ghost btn-sm">Mở để duyệt</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby="grade-pending">
            <h2 id="grade-pending" className="text-h3">Bài chờ chấm ({o.pendingGradeTotal})</h2>
            {o.pendingGrade.length === 0 ? (
              <p className="text-meta mt-2">Không có bài chờ chấm.</p>
            ) : (
              <ul className="mt-3 divide-y divide-[rgb(var(--border))] rounded-xl border border-token bg-[rgb(var(--surface))]">
                {o.pendingGrade.map((p) => (
                  <li key={p.submissionId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <span className="min-w-0"><b>{p.studentName}</b> · {p.assignmentTitle} <span className="text-muted">— {LANGUAGE_SKILL_LABEL[p.skill]}, {p.courseTitle}</span></span>
                    <Link href={`/instructor/assignments/${p.assignmentId}/submissions`} className="btn-ghost btn-sm">Chấm</Link>
                  </li>
                ))}
              </ul>
            )}
            {o.pendingGradeTotal > o.pendingGrade.length && <p className="text-meta mt-2">Hiện 5 bài cũ nhất; mở bài tập để xem hết.</p>}
          </section>
        </>
      )}
    </PageFrame>
  );
}
