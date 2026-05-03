import { redirect } from "next/navigation";
import { getTemplateRatingStats } from "@feedbackme/core-feedback";
import { isAdmin } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function FeedbackTemplatesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/instructor/feedback-templates");

  // Any course instructor or admin can see it.
  const [admin, anyCourse] = await Promise.all([
    isAdmin(session.user.id),
    prisma.courseInstructor.findFirst({ where: { userId: session.user.id } }),
  ]);
  if (!admin && !anyCourse) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="rounded border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          Chỉ instructor hoặc admin mới xem được trang này.
        </p>
      </main>
    );
  }

  const stats = await getTemplateRatingStats();

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-bold">Chất lượng feedback templates</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Sắp xếp theo netScore (👍 − 👎) tăng dần — template tệ nhất ở trên cùng để
        bạn ưu tiên sửa.
      </p>

      {stats.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">Chưa có template nào.</p>
      ) : (
        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700">
              <th className="py-2 pr-3">Scope</th>
              <th className="py-2 pr-3">Body (snippet)</th>
              <th className="py-2 pr-3">Đã gửi</th>
              <th className="py-2 pr-3">Đã rate</th>
              <th className="py-2 pr-3">👍</th>
              <th className="py-2 pr-3">👎</th>
              <th className="py-2 pr-3">Net</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr
                key={s.templateId}
                className="border-b border-slate-200 align-top dark:border-slate-800"
              >
                <td className="py-2 pr-3 text-xs uppercase text-slate-500">
                  {s.scope}
                </td>
                <td className="py-2 pr-3">
                  <p className="line-clamp-2 max-w-md text-xs text-slate-700 dark:text-slate-300">
                    {s.body}
                  </p>
                </td>
                <td className="py-2 pr-3 tabular-nums">{s.totalDelivered}</td>
                <td className="py-2 pr-3 tabular-nums text-slate-500">
                  {s.totalRated}
                </td>
                <td className="py-2 pr-3 tabular-nums text-emerald-700 dark:text-emerald-300">
                  {s.thumbsUp}
                </td>
                <td className="py-2 pr-3 tabular-nums text-red-700 dark:text-red-300">
                  {s.thumbsDown}
                </td>
                <td
                  className={`py-2 pr-3 tabular-nums font-medium ${
                    s.netScore < 0
                      ? "text-red-700 dark:text-red-300"
                      : s.netScore > 0
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-slate-500"
                  }`}
                >
                  {s.netScore > 0 ? "+" : ""}
                  {s.netScore}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
