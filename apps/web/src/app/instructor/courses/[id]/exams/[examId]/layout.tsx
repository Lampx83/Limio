import { prisma } from "@feedbackme/db";
import { SetActiveNavSection } from "@/lib/activeNavSection";

// A6.5 — /instructor/courses/[id]/exams/[examId]/* (overview, content, live,
// grading) dùng chung 1 path pattern cho cả đề thi viết lẫn đề vấn đáp AI.
// InstructorLeftMenu chỉ suy active item từ pathname nên mặc định luôn sáng
// "Đề thi" — sai với vấn đáp, vốn có mục riêng "Phòng thi vấn đáp". Layout
// này là nơi duy nhất biết `exam.kind` mà không phải sửa từng page con.
export default async function ExamEditorLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { examId: string };
}) {
  const exam = await prisma.exam.findUnique({
    where: { id: params.examId },
    select: { kind: true },
  });

  return (
    <>
      {exam?.kind === "oral" && <SetActiveNavSection href="/instructor/oral-exams" />}
      {children}
    </>
  );
}
