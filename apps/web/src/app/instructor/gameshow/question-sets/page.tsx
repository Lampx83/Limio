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
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">📝 Bộ câu hỏi Gameshow</h1>
          <p className="mt-1 text-sm text-faint">
            Soạn câu hỏi trực tiếp cho Gameshow — không cần Quiz có sẵn.
          </p>
        </div>
        <Link
          href="/instructor/gameshow/question-sets/new"
          className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + Bộ mới
        </Link>
      </div>

      {sets.length === 0 ? (
        <div className="mt-6 rounded border border-dashed border-default p-6 text-center text-sm text-faint">
          Chưa có bộ câu hỏi nào.
        </div>
      ) : (
        <ul className="mt-6 space-y-2">
          {sets.map((s) => (
            <li key={s.id}>
              <Link
                href={`/instructor/gameshow/question-sets/${s.id}`}
                className="flex items-center justify-between rounded border border-default bg-white p-4 hover:border-blue-400 hover:bg-blue-50"
              >
                <div>
                  <p className="text-sm font-semibold">{s.title}</p>
                  <p className="mt-0.5 text-xs text-faint">
                    {s._count.items} câu hỏi · cập nhật {formatDateTime(s.updatedAt)}
                  </p>
                </div>
                <span className="text-sm text-blue-600">Sửa →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
