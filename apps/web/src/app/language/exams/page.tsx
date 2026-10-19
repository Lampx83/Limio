import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { getLanguageTeacherOverview } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { NOINDEX } from "@/lib/seo";
import EmptyState from "@/components/ui/EmptyState";
import PageFrame from "@/components/language/PageFrame";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Đề thi — Limio Language", ...NOINDEX };

const STATUS: Record<string, string> = { draft: "Đang soạn", published: "Đã xuất bản", archived: "Lưu trữ" };

/** Danh sách đề ngoại ngữ (thi thử & luyện đề) trong các khoá tôi dạy. Bảng có lọc/phân trang theo quy mô thư viện: L6.6. */
export default async function LanguageExams() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/language/exams");
  const overview = await getLanguageTeacherOverview(session.user.id);
  const banks = overview.courses.filter((c) => c.kind === "practice_bank");
  const exams = await prisma.exam.findMany({
    where: {
      mockMode: true,
      status: { not: "archived" },
      course: { languageMode: true, instructors: { some: { userId: session.user.id } } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      title: true,
      status: true,
      courseId: true,
      allowMock: true,
      allowPractice: true,
      course: { select: { title: true } },
      sections: { orderBy: { orderIndex: "asc" }, select: { languageSkill: true } },
      _count: { select: { attempts: true } },
    },
  });
  return (
    <PageFrame
      title="Đề thi"
      description="Đề thi thử & luyện đề của các khoá ngoại ngữ bạn dạy."
      actions={
        <>
          <Link href="/language/courses/new-practice" className="btn-secondary btn-sm">Tạo khoá luyện đề</Link>
          <Link href="/language/exams/new" className="btn-primary btn-sm">Tạo đề thi ngoại ngữ</Link>
        </>
      }
    >
      {banks.length > 0 && (
        <section aria-label="Khoá luyện đề">
          <h2 className="text-h3">Khoá luyện đề</h2>
          <ul className="mt-3 divide-y divide-[rgb(var(--border))] rounded-xl border border-token bg-[rgb(var(--surface))]">
            {banks.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <div className="font-medium">{b.title}</div>
                  <div className="text-caption text-muted">{b.examCount} đề · {b.studentCount} học viên · {b.status === "published" ? "Đã xuất bản" : "Nháp"}</div>
                </div>
                <Link href={`/instructor/courses/${b.id}/library`} className="btn-primary btn-sm">Quản lý thư viện đề</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {exams.length === 0 ? (
        <EmptyState
          title="Chưa có đề thi ngoại ngữ"
          description="Tạo đề từ khung HSK, IELTS, TOEIC hoặc đề trống."
          actions={[{ label: "Tạo đề thi ngoại ngữ", href: "/language/exams/new", variant: "primary" }]}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-token bg-[rgb(var(--surface))]">
          <table className="w-full text-sm">
            <thead className="text-left text-caption">
              <tr className="border-b border-token">
                <th className="px-4 py-2">Đề</th>
                <th className="px-4 py-2">Khoá</th>
                <th className="px-4 py-2">Trạng thái</th>
                <th className="px-4 py-2">Chế độ</th>
                <th className="px-4 py-2 text-right">Phần</th>
                <th className="px-4 py-2 text-right">Lượt làm</th>
              </tr>
            </thead>
            <tbody>
              {exams.map((e) => (
                <tr key={e.id} className="border-b border-token last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/instructor/courses/${e.courseId}/exams/${e.id}`} className="font-medium hover:underline">{e.title}</Link>
                  </td>
                  <td className="px-4 py-2 text-muted">{e.course?.title}</td>
                  <td className="px-4 py-2">{STATUS[e.status] ?? e.status}</td>
                  <td className="px-4 py-2 text-muted">{[e.allowMock && "Thi thử", e.allowPractice && "Luyện đề"].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{e.sections.length}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{e._count.attempts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageFrame>
  );
}
