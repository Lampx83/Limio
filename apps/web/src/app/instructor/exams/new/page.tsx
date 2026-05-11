import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import NewExamForm from "./NewExamForm";

export const dynamic = "force-dynamic";

export default async function NewExamHubPage({
  searchParams,
}: {
  searchParams?: { courseId?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/instructor/exams/new");

  const ownedCourses = await prisma.course.findMany({
    where: { instructors: { some: { userId: session.user.id } } },
    select: { id: true, title: true, slug: true },
    orderBy: { updatedAt: "desc" },
  });

  if (ownedCourses.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12 text-center">
        <h1 className="text-2xl font-bold">Tạo bài thi</h1>
        <p className="mt-4 text-sm text-faint">
          Bạn cần là instructor của một khóa học trước khi tạo bài thi.
        </p>
        <Link
          href="/instructor/courses/new"
          className="mt-6 inline-block rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
        >
          + Tạo khóa đầu tiên
        </Link>
      </main>
    );
  }

  const preselectedCourseId =
    searchParams?.courseId && ownedCourses.some((c) => c.id === searchParams.courseId)
      ? searchParams.courseId
      : ownedCourses[0]!.id;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/instructor/exams" className="text-sm text-blue-600 hover:underline">
        ← Bài thi
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Tạo bài thi mới</h1>
      <p className="mt-1 text-sm text-faint">
        Chọn khoá học và thiết lập thông số. Sau khi tạo, bạn sẽ thêm đoạn bài
        đọc và câu hỏi ở bước tiếp theo.
      </p>

      <div className="mt-6">
        <NewExamForm
          courses={ownedCourses}
          initialCourseId={preselectedCourseId}
        />
      </div>
    </main>
  );
}
