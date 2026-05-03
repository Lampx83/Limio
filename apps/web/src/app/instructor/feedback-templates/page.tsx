import Link from "next/link";
import { redirect } from "next/navigation";
import { getTemplateRatingStats } from "@feedbackme/core-feedback";
import { isAdmin } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function FeedbackTemplatesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/instructor/feedback-templates");

  const [admin, anyCourse] = await Promise.all([
    isAdmin(session.user.id),
    prisma.courseInstructor.findFirst({ where: { userId: session.user.id } }),
  ]);
  if (!admin && !anyCourse) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-2xl border border-danger-100 bg-danger-50 p-5 text-sm text-danger-700">
          🚫 Chỉ instructor hoặc admin mới xem được trang này.
        </div>
      </main>
    );
  }

  const stats = await getTemplateRatingStats();

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link
        href="/instructor/courses"
        className="link inline-flex items-center gap-1 text-sm"
      >
        ← Khóa của tôi
      </Link>

      <div className="mt-4">
        <span className="chip-brand">Analytics</span>
        <h1 className="mt-3 h-display text-3xl font-bold sm:text-4xl">
          Chất lượng feedback templates
        </h1>
        <p className="mt-2 text-muted">
          Sắp xếp theo netScore (👍 − 👎) tăng dần — template tệ nhất ở trên cùng
          để bạn ưu tiên sửa.
        </p>
      </div>

      {stats.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-token p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-2xl">
            💬
          </div>
          <p className="mt-4 text-muted">Chưa có template nào.</p>
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))] shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-[rgb(var(--surface-muted))]">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Scope</th>
                <th className="px-4 py-3">Body (snippet)</th>
                <th className="px-4 py-3 text-right">Đã gửi</th>
                <th className="px-4 py-3 text-right">Đã rate</th>
                <th className="px-4 py-3 text-right">👍</th>
                <th className="px-4 py-3 text-right">👎</th>
                <th className="px-4 py-3 text-right">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-token">
              {stats.map((s) => (
                <tr
                  key={s.templateId}
                  className="transition-colors hover:bg-[rgb(var(--surface-muted))]"
                >
                  <td className="px-4 py-3 align-top">
                    <span className="chip">{s.scope}</span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <p className="line-clamp-2 max-w-md text-sm">{s.body}</p>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums align-top">
                    {s.totalDelivered}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-faint align-top">
                    {s.totalRated}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-success-600 align-top">
                    {s.thumbsUp}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-danger-600 align-top">
                    {s.thumbsDown}
                  </td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums font-semibold align-top ${
                      s.netScore < 0
                        ? "text-danger-600"
                        : s.netScore > 0
                          ? "text-success-600"
                          : "text-faint"
                    }`}
                  >
                    {s.netScore > 0 ? "+" : ""}
                    {s.netScore}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
