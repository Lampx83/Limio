import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLanguageTeacherOverview } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { NOINDEX } from "@/lib/seo";
import EmptyState from "@/components/ui/EmptyState";
import PageFrame from "@/components/language/PageFrame";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tạo đề thi ngoại ngữ — Limio Language", ...NOINDEX };

/** Đề thuộc một khoá: chọn khoá rồi vào luồng tạo đề ngoại ngữ (một khoá thì đi thẳng). */
export default async function NewLanguageExam() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/language/exams/new");
  const o = await getLanguageTeacherOverview(session.user.id);
  if (o.courses.length === 1) redirect(`/instructor/courses/${o.courses[0]!.id}/exams/new?type=language`);
  return (
    <PageFrame title="Tạo đề thi ngoại ngữ" description="Chọn khoá chứa đề.">
      {o.courses.length === 0 ? (
        <EmptyState title="Bạn chưa có khoá ngoại ngữ" description="Đề thi thuộc về một khoá. Tạo khoá trước." actions={[{ label: "Tạo khoá", href: "/instructor/courses/new", variant: "primary" }]} />
      ) : (
        <ul className="divide-y divide-[rgb(var(--border))] rounded-xl border border-token bg-[rgb(var(--surface))]">
          {o.courses.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 px-4 py-3">
              <span className="font-medium">{c.title}</span>
              <Link href={`/instructor/courses/${c.id}/exams/new?type=language`} className="btn-primary btn-sm">Tạo đề ở khoá này</Link>
            </li>
          ))}
        </ul>
      )}
    </PageFrame>
  );
}
