import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import QuickExamForm from "./QuickExamForm";

export const dynamic = "force-dynamic";

/**
 * Mở một buổi thi từ một GÓI ĐỀ có sẵn.
 *
 * Tách bạch hai thứ mà `Exam` đang gánh chung:
 *   - gói đề  = hỏi cái gì (câu hỏi, đoạn văn). Soạn ở mục "Đề thi".
 *   - buổi thi = chạy khi nào, bao lâu, ai vào. Quyết định ở đây.
 *
 * Mô hình dữ liệu đã đỡ sẵn: một Exam có nhiều ExamSession, và mỗi ca có
 * durationOverrideMin riêng. Cùng một gói đề chạy 15 phút ở lớp này và 30 phút
 * ở lớp kia là chuyện bình thường.
 */
export default async function QuickExamPage({
  searchParams,
}: {
  searchParams?: { purpose?: string };
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
        <h1 className="text-2xl font-bold">Mở buổi thi</h1>
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

  // Gói đề dùng được: có câu hỏi, chưa bị lưu trữ. Đề thử nghiệm chỉ hiện ở
  // luồng thử nghiệm và ngược lại — trộn hai loại là nguồn của nhầm lẫn.
  const papers = await prisma.exam.findMany({
    where: {
      courseId: { in: courses.map((c) => c.id) },
      status: { not: "archived" },
      purpose,
      questions: { some: {} },
    },
    select: {
      id: true,
      title: true,
      courseId: true,
      durationMin: true,
      _count: { select: { questions: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  const courseTitleById = new Map(courses.map((c) => [c.id, c.title]));

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
          ? "Chọn gói đề thử nghiệm, đặt thời lượng, phát link. Đề loại này không hiện đáp án sau khi nộp."
          : "Chọn gói đề, đặt thời lượng, phát link. Mặc định mở ngay và đóng khi bạn bấm."}
      </p>

      <QuickExamForm
        purpose={purpose}
        courses={courses}
        papers={papers.map((p) => ({
          id: p.id,
          title: p.title,
          courseId: p.courseId,
          courseTitle: courseTitleById.get(p.courseId) ?? "",
          questionCount: p._count.questions,
          defaultDurationMin: p.durationMin,
        }))}
      />
    </main>
  );
}
