import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { NOINDEX } from "@/lib/seo";
import PageFrame from "@/components/language/PageFrame";
import NewPracticeForm from "./NewPracticeForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tạo khoá luyện đề — Limio Language", ...NOINDEX };

export default async function NewPracticeCourse() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/language/courses/new-practice");
  return (
    <PageFrame
      title="Tạo khoá luyện đề"
      description="Khoá theo từng kỹ năng của một họ thi: học viên mua khoá là có thư viện đề, mỗi đề làm được theo hai chế độ — Luyện đề (không giới hạn giờ) và Phòng thi mô phỏng (bấm giờ)."
    >
      <NewPracticeForm />
    </PageFrame>
  );
}
