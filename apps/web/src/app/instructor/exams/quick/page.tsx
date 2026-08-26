import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import QuickExamForm from "./QuickExamForm";

export const dynamic = "force-dynamic";

/**
 * Tạo nhanh một bài thi — một trang, ba ô.
 *
 * Thay cho form 13 trường của màn hình tạo đề đầy đủ. Mọi thứ khác dùng mặc
 * định và sửa được sau ở màn hình đề.
 */
export default async function QuickExamPage({
  searchParams,
}: {
  searchParams?: { purpose?: string; courseId?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/instructor/exams/quick");

  const purpose =
    searchParams?.purpose === "field_test" ? "field_test" : "assessment";

  const courses = await prisma.course.findMany({
    where: { instructors: { some: { userId: session.user.id } } },
    select: { id: true, title: true },
    orderBy: { updatedAt: "desc" },
  });

  if (courses.length === 0) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10 text-center lg:px-6">
        <h1 className="text-2xl font-bold">Tạo bài kiểm tra</h1>
        <p className="mt-3 text-sm text-faint">
          Bạn cần là giảng viên của một khoá học trước đã.
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

  return (
    <main className="mx-auto max-w-xl px-4 py-6 lg:px-6">
      <Link href="/instructor/organize" className="text-sm text-faint hover:underline">
        ← Tổ chức thi
      </Link>
      <h1 className="mt-2 text-2xl font-bold">
        {purpose === "field_test" ? "Mở đợt thử nghiệm" : "Tạo link thi nhanh"}
      </h1>
      <p className="mt-1 text-body text-faint">
        {purpose === "field_test"
          ? "Đề đo chất lượng câu hỏi. Không hiện đáp án sau khi nộp, và chở được câu chưa kết nạp vào ngân hàng."
          : "Điền hai ô, thêm câu hỏi, phát link. Những thứ khác sửa được sau."}
      </p>

      <QuickExamForm
        purpose={purpose}
        courses={courses}
        initialCourseId={searchParams?.courseId ?? courses[0]!.id}
      />
    </main>
  );
}
