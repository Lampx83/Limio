import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLanguageLearnerOverview, getLanguageTeacherOverview } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { getActiveRole } from "@/lib/active-role";
import { languageShellRole } from "@/lib/languageMenu";
import { NOINDEX } from "@/lib/seo";
import EmptyState from "@/components/ui/EmptyState";
import PageFrame from "@/components/language/PageFrame";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Khoá ngoại ngữ — Limio Language", ...NOINDEX };

export default async function LanguageCourses() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/language/courses");
  const role = languageShellRole(getActiveRole(session.user.roles ?? []));

  if (role === "teacher") {
    const o = await getLanguageTeacherOverview(session.user.id);
    return (
      <PageFrame
        title="Khoá ngoại ngữ"
        description="Các khoá bạn dạy có bật chế độ ngoại ngữ."
        actions={
          <>
            <Link href="/language/courses/new-practice" className="btn-primary btn-sm">Tạo khoá luyện đề</Link>
            <Link href="/instructor/courses/new" className="btn-secondary btn-sm">Tạo khoá / khoá mẫu</Link>
          </>
        }
      >
        {o.courses.length === 0 ? (
          <EmptyState title="Chưa có khoá ngoại ngữ" description="Tạo từ khoá mẫu Tiếng Trung/Tiếng Anh hoặc bật chế độ ngoại ngữ cho một khoá có sẵn." actions={[{ label: "Tạo khoá", href: "/instructor/courses/new", variant: "primary" }]} />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-token bg-[rgb(var(--surface))]">
            <table className="w-full text-sm">
              <thead className="text-left text-caption">
                <tr className="border-b border-token">
                  <th className="px-4 py-2">Khoá</th>
                  <th className="px-4 py-2">Trạng thái</th>
                  <th className="px-4 py-2 text-right">Học viên</th>
                  <th className="px-4 py-2 text-right">Đề</th>
                  <th className="px-4 py-2 text-right">Chờ chấm</th>
                </tr>
              </thead>
              <tbody>
                {o.courses.map((c) => (
                  <tr key={c.id} className="border-b border-token last:border-0">
                    <td className="px-4 py-2">
                      <Link href={c.kind === "practice_bank" ? `/instructor/courses/${c.id}/library` : `/instructor/courses/${c.id}`} className="font-medium hover:underline">{c.title}</Link>
                      {c.kind === "practice_bank" && <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-800">Luyện đề</span>}
                    </td>
                    <td className="px-4 py-2">{c.status === "published" ? "Đã xuất bản" : "Nháp"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{c.studentCount}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{c.examCount}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{c.pendingGrade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageFrame>
    );
  }

  const o = await getLanguageLearnerOverview(session.user.id);
  return (
    <PageFrame title="Khoá của tôi" description="Các khoá ngoại ngữ bạn đang học." actions={<Link href="/catalog" className="btn-secondary btn-sm">Tìm khoá khác</Link>}>
      {o.courses.length === 0 ? (
        <EmptyState title="Bạn chưa học khoá ngoại ngữ nào" actions={[{ label: "Xem catalog", href: "/catalog", variant: "primary" }]} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {o.courses.map((c) => (
            <li key={c.id} className="rounded-xl border border-token bg-[rgb(var(--surface))] p-4">
              <Link href={`/learn/${c.slug}`} className="font-medium hover:underline">{c.title}</Link>
              <div className="text-caption mt-1 text-muted">{c.openExamCount} đề đang mở{c.kind === "practice_bank" ? " · khoá luyện đề" : ""}</div>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                {c.kind === "practice_bank" ? (
                  <Link href={`/learn/${c.slug}/practice`} className="btn-primary btn-sm">Vào thư viện đề</Link>
                ) : (
                  <>
                    {c.lastLessonId && <Link href={`/learn/${c.slug}/lessons/${c.lastLessonId}`} className="btn-primary btn-sm">Tiếp tục</Link>}
                    <Link href={`/learn/${c.slug}/flashcards`} className="btn-ghost btn-sm">Thẻ ôn từ</Link>
                    <Link href={`/learn/${c.slug}/skills`} className="btn-ghost btn-sm">Kỹ năng</Link>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageFrame>
  );
}
