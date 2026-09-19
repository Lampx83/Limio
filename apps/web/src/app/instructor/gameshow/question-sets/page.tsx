import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import { formatDateTime } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export default async function QuestionSetsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=/instructor/gameshow/question-sets`);
  }
  const userId = session.user.id;

  const sets = await prisma.gameQuestionSet.findMany({
    where: { ownerId: userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true, _count: { select: { items: true } } },
  });

  return (
    <main className="w-full py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h2">Bộ câu hỏi Gameshow</h1>
          <p className="text-meta mt-1.5">
            Soạn câu hỏi trực tiếp cho Gameshow — không cần Quiz có sẵn.
          </p>
        </div>
        <Link
          href="/instructor/gameshow/question-sets/new"
          className="btn-primary"
        >
          + Bộ mới
        </Link>
      </div>

      {sets.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-[rgb(var(--border))] p-8 text-center text-sm text-[rgb(var(--text-muted))]">
          Chưa có bộ câu hỏi nào.
        </div>
      ) : (
        <ul className="mt-8 space-y-2">
          {sets.map((s) => (
            <li key={s.id}>
              <Link
                href={`/instructor/gameshow/question-sets/${s.id}`}
                className="group flex items-center justify-between rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-5 py-4 transition-all duration-150 hover:border-[rgb(var(--brand)/0.5)] hover:bg-[rgb(var(--brand)/0.05)] hover:shadow-sm"
                prefetch={false}
              >
                <div>
                  <p className="text-sm font-semibold">{s.title}</p>
                  <p className="text-caption mt-0.5">
                    {s._count.items} câu hỏi · cập nhật {formatDateTime(s.updatedAt)}
                  </p>
                </div>
                <span className="text-sm font-medium text-[rgb(var(--brand))]">Sửa</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
