import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { canEditCourse, listExamCollections } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { NOINDEX } from "@/lib/seo";
import LibraryManager from "./LibraryManager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Thư viện đề", ...NOINDEX };

/** LANG L6.6 — quản lý thư viện đề của khoá luyện đề (bảng, thao tác hàng loạt, bộ, nhập hàng loạt). */
export default async function CourseLibraryPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect(`/signin?callbackUrl=/instructor/courses/${params.id}/library`);
  const course = await prisma.course.findUnique({ where: { id: params.id }, select: { id: true, title: true, kind: true, slug: true } });
  if (!course) notFound();
  if (!(await canEditCourse(session.user.id, course.id))) redirect("/instructor/courses");
  const collections = await listExamCollections(session.user.id, course.id);
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <Link href={`/instructor/courses/${course.id}`} className="link text-sm">← {course.title}</Link>
      <h1 className="text-h1 mt-2">Thư viện đề</h1>
      <p className="text-meta mt-1 max-w-2xl">
        Quản lý các đề của khoá: lọc, chọn nhiều đề để gán bộ/loại/độ khó, bật tắt chế độ, xuất bản; thêm từng đề hoặc nhập hàng loạt từ file.
        {course.kind !== "practice_bank" && " (Khoá này chưa phải khoá luyện đề nên học viên chưa thấy thư viện — đề vẫn dùng được như đề thi thử thường.)"}
      </p>
      <div className="mt-5">
        <LibraryManager courseId={course.id} initialCollections={collections.map((c) => ({ id: c.id, title: c.title, examCount: c.examCount }))} />
      </div>
    </main>
  );
}
