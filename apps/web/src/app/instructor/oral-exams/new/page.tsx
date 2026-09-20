import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { requireFeature } from "@/lib/session";
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
  const userId = await requireFeature("ai_oral.access");
  if (!userId) redirect("/instructor/dashboard");

  const ownedCourses = await prisma.course.findMany({
    where: { instructors: { some: { userId } } },
    select: { id: true, title: true },
    orderBy: { updatedAt: "desc" },
  });

  // Mặc định "Không gắn khoá học" — tự chọn sẵn khoá đầu tiên (hành vi cũ)
  // khiến GV tưởng đề bắt buộc phải gắn khoá, không để ý dropdown có tuỳ
  // chọn "Không gắn khoá học". Chỉ tự điền khi có ?courseId= tường minh
  // (vd link "Tạo đề vấn đáp" từ ngay trong 1 khoá học cụ thể).
  const preselectedCourseId =
    searchParams?.courseId && ownedCourses.some((c) => c.id === searchParams.courseId)
      ? searchParams.courseId
      : "";

  return (
    <main>
      <Link href="/instructor/oral-exams" className="text-sm text-blue-600 hover:underline">
        ← Phòng vấn đáp AI
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
