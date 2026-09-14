import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import OralNewExamForm from "./OralNewExamForm";

export const dynamic = "force-dynamic";

/** A6.5 — Điểm tạo đề vấn đáp AI riêng, tách khỏi luồng tạo đề thi viết
 * (/instructor/exams/new) — kind cố định = oral, không có wizard Cơ bản/
 * Nâng cao vì vấn đáp không có ngân hàng câu hỏi để lấy mẫu. */
export default async function NewOralExamPage({
  searchParams,
}: {
  searchParams?: { courseId?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/instructor/oral-exams/new");
  const userId = session.user.id;

  const ownedCourses = await prisma.course.findMany({
    where: { instructors: { some: { userId } } },
    select: { id: true, title: true },
    orderBy: { updatedAt: "desc" },
  });

  if (ownedCourses.length === 0) {
    return (
      <main className="text-center">
        <h1 className="text-2xl font-bold">Tạo đề vấn đáp</h1>
        <p className="mt-4 text-sm text-faint">
          Bạn cần là giảng viên của một khoá học trước khi tạo đề vấn đáp.
        </p>
        <Link
          href="/instructor/courses/new"
          className="mt-6 inline-block rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
        >
          + Tạo khoá đầu tiên
        </Link>
      </main>
    );
  }

  const preselectedCourseId =
    searchParams?.courseId && ownedCourses.some((c) => c.id === searchParams.courseId)
      ? searchParams.courseId
      : ownedCourses[0]!.id;

  return (
    <main>
      <Link href="/instructor/oral-exams" className="text-sm text-blue-600 hover:underline">
        ← Phòng thi Vấn đáp AI
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Tạo đề vấn đáp mới</h1>
      <p className="mt-1 text-sm text-faint">
        Sau khi tạo, bạn sẽ nộp tài liệu để AI dựa vào đó hỏi sinh viên.
      </p>

      <div className="mt-6">
        <OralNewExamForm courses={ownedCourses} initialCourseId={preselectedCourseId} />
      </div>
    </main>
  );
}
