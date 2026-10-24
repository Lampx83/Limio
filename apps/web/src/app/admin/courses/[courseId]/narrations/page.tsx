import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@feedbackme/db";
import NarrationsManager from "./NarrationsManager";

export const dynamic = "force-dynamic";

export default async function CourseNarrationsPage({ params }: { params: { courseId: string } }) {
  const course = await prisma.course.findUnique({
    where: { id: params.courseId },
    select: { id: true, title: true },
  });
  if (!course) notFound();

  return (
    <main>
      <Link href="/admin/courses" className="link inline-flex items-center gap-1 text-sm">
        ← Quản lý khoá học
      </Link>
      <header className="mb-6 mt-3">
        <h1 className="h-display text-2xl font-bold sm:text-3xl">Giọng đọc — {course.title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Lời giảng (“Nghe giảng”) và kịch bản podcast của từng bài được lưu cùng bài khi nhập khoá. Ở đây bạn tạo giọng đọc
          một lần; học viên nghe chung tệp đó. Sửa lời của bài thì giọng cũ bị ẩn khỏi học viên cho tới khi tạo lại.
        </p>
      </header>
      <NarrationsManager courseId={course.id} />
    </main>
  );
}
