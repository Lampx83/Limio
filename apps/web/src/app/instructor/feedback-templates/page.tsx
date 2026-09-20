import Link from "next/link";
import { redirect } from "next/navigation";
import { getTemplateRatingStatsWithPagination } from "@feedbackme/core-feedback";
import { isAdmin } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import TemplatesBrowser from "./TemplatesBrowser";

export const dynamic = "force-dynamic";

export default async function FeedbackTemplatesPage({
  searchParams,
}: {
  searchParams: {
    page?: string;
    sortBy?: "netScore" | "delivered" | "rated" | "scope";
    sortOrder?: "asc" | "desc";
    status?: "all" | "needsFix" | "good" | "notRated";
    q?: string;
  };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/instructor/feedback-templates");

  const [admin, anyCourse] = await Promise.all([
    isAdmin(session.user.id),
    prisma.courseInstructor.findFirst({ where: { userId: session.user.id } }),
  ]);
  if (!admin && !anyCourse) {
    return (
      <main>
        <div className="rounded-2xl border border-danger-100 bg-danger-50 p-5 text-sm text-danger-700">
          Chỉ instructor hoặc admin mới xem được trang này.
        </div>
      </main>
    );
  }

  const page = Math.max(0, Number(searchParams.page ?? 0));
  const limit = 12;

  const result = await getTemplateRatingStatsWithPagination({
    page,
    limit,
    sortBy: (searchParams.sortBy ?? "netScore") as any,
    sortOrder: (searchParams.sortOrder ?? "asc") as any,
    statusFilter: (searchParams.status ?? "all") as any,
    search: searchParams.q ?? "",
  });

  return (
    <main>
      <Link
        href="/instructor/dashboard"
        className="link inline-flex items-center gap-1 text-sm"
      >
        ← Dashboard
      </Link>

      <div className="mt-4">
        <span className="chip-brand">Analytics</span>
        <h1 className="mt-3 text-2xl font-bold">
          Chất lượng feedback templates
        </h1>
        <p className="mt-2 text-muted">
          Chi tiết đầy đủ về hiệu suất các template feedback của bạn.
        </p>
      </div>

      <TemplatesBrowser
        stats={result.stats}
        total={result.total}
        page={result.page}
        pageCount={result.pageCount}
        currentSort={searchParams.sortBy}
        currentOrder={searchParams.sortOrder}
        currentStatus={searchParams.status}
        currentSearch={searchParams.q}
      />
    </main>
  );
}
