import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { canEditCourse } from "@feedbackme/core-lms";
import { BookOpen, ChevronRight, Dices, Grid3x3 } from "lucide-react";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface MethodCardProps {
  href: string;
  icon: typeof BookOpen;
  badge: string;
  badgeTone: "brand" | "slate";
  title: string;
  description: string;
  fit: string;
}

function MethodCard({ href, icon: Icon, badge, badgeTone, title, description, fit }: MethodCardProps) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col gap-4 rounded-xl border border-default bg-white p-7 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg"
    >
      <ChevronRight className="absolute right-6 top-7 h-5 w-5 text-faint transition group-hover:text-brand-600" />
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50">
        <Icon className="h-7 w-7 text-brand-600" strokeWidth={1.8} />
      </div>
      <div className="flex flex-col gap-1.5">
        <span
          className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${
            badgeTone === "brand" ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-600"
          }`}
        >
          {badge}
        </span>
        <h3 className="text-h4">{title}</h3>
        <p className="text-meta">{description}</p>
      </div>
      <div className="mt-auto border-t border-default pt-3">
        <p className="text-caption">Phù hợp khi: {fit}</p>
      </div>
    </Link>
  );
}

export default async function ContentSourceSelectPage({
  params,
  searchParams,
}: {
  params: { id: string; examId: string };
  searchParams?: { sectionId?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/signin?callbackUrl=/instructor/courses/${params.id}/exams/${params.examId}/content`,
    );
  }

  const exam = await prisma.exam.findUnique({
    where: { id: params.examId },
    select: { id: true, courseId: true, title: true, kind: true },
  });
  if (!exam || exam.courseId !== params.id) notFound();
  if (exam.kind !== "written") notFound();
  if (!(await canEditCourse(session.user.id, exam.courseId))) {
    redirect("/instructor/courses");
  }

  // Chỉ "Chọn thủ công" gán được vào 1 "Phần" có sẵn (rút nhanh/ma trận luôn
  // tự tạo section riêng) — thêm câu cho 1 Phần cụ thể thì bỏ qua bước chọn
  // phương thức, vào thẳng trang thủ công, y hệt cách modal cũ ẩn tab bar khi
  // có sectionId.
  const sectionId = searchParams?.sectionId;
  if (sectionId) {
    redirect(
      `/instructor/courses/${params.id}/exams/${params.examId}/content/manual?sectionId=${sectionId}`,
    );
  }

  const backHref = `/instructor/courses/${params.id}/exams/${params.examId}?tab=content`;

  return (
    <main>
      <Link href={backHref} className="text-sm text-faint hover:text-brand-700">
        ← Quay lại: {exam.title}
      </Link>

      <div className="mt-6 max-w-2xl">
        <h1 className="text-h2">Thêm câu hỏi từ ngân hàng</h1>
        <p className="mt-2 text-meta">
          Chọn cách bạn muốn rút câu hỏi. Bấm vào một cách để mở trang riêng — bạn có thể quay lại
          và đổi cách khác bất cứ lúc nào.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <MethodCard
          href={`/instructor/courses/${params.id}/exams/${params.examId}/content/quick`}
          icon={Dices}
          badge="Nhanh nhất"
          badgeTone="brand"
          title="Chọn nhanh theo tiêu chí"
          description="Nhập số lượng câu và tiêu chí (chủ đề, độ khó), hệ thống tự rút ngẫu nhiên."
          fit="cần ra đề nhanh, không yêu cầu kiểm soát từng câu."
        />
        <MethodCard
          href={`/instructor/courses/${params.id}/exams/${params.examId}/content/manual`}
          icon={BookOpen}
          badge="Kiểm soát từng câu"
          badgeTone="slate"
          title="Chọn thủ công"
          description="Duyệt danh sách câu hỏi trong ngân hàng, xem trước nội dung và tự tay chọn từng câu."
          fit="bạn cần chọn chính xác từng câu, không muốn hệ thống tự rút."
        />
        <MethodCard
          href={`/instructor/courses/${params.id}/exams/${params.examId}/content/blueprint`}
          icon={Grid3x3}
          badge="Chuẩn hoá theo ma trận"
          badgeTone="slate"
          title="Theo ma trận đề thi"
          description="Đặt tỉ lệ câu hỏi theo chủ đề × mức độ nhận thức, hệ thống lắp đề theo ma trận đề."
          fit="đề thi cần cân bằng chủ đề/độ khó theo yêu cầu của khảo thí hoặc chuẩn đánh giá."
        />
      </div>
    </main>
  );
}
