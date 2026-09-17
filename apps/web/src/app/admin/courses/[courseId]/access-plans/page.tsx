import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@feedbackme/db";
import AccessPlansManager from "./AccessPlansManager";

export const dynamic = "force-dynamic";

export default async function CourseAccessPlansPage({
  params,
}: {
  params: { courseId: string };
}) {
  const course = await prisma.course.findUnique({
    where: { id: params.courseId },
    select: { id: true, title: true, slug: true, priceCents: true, currency: true },
  });
  if (!course) notFound();

  return (
    <main>
      <Link href="/admin/courses" className="link inline-flex items-center gap-1 text-sm">
        ← Quản lý khoá học
      </Link>
      <header className="mb-6 mt-3">
        <h1 className="h-display text-2xl font-bold sm:text-3xl">
          Gói bán — {course.title}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Định giá &amp; thời hạn truy cập (1 năm, 2 năm, vĩnh viễn...) cho khoá học này.
          Đây là gói học viên chọn khi thanh toán qua Stripe.
        </p>
      </header>
      <AccessPlansManager
        courseId={course.id}
        defaultCurrency={course.currency}
      />
    </main>
  );
}
