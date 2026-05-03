import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import CreateTournamentForm from "./CreateTournamentForm";

export const dynamic = "force-dynamic";

export default async function NewTournamentPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/instructor/tournaments/new");
  }
  const userId = session.user.id;

  const admin = await isAdmin(userId);
  // Build the list of courses the user can attach a tournament to.
  const myCourses = await prisma.course.findMany({
    where: admin
      ? {}
      : { instructors: { some: { userId } } },
    orderBy: { title: "asc" },
    select: { id: true, title: true },
  });

  if (!admin && myCourses.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="rounded border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          Bạn không phải instructor của khóa nào. Chỉ instructor hoặc admin mới
          tạo được tournament.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/instructor/courses" className="text-sm underline">
        ← Khóa của tôi
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Tạo tournament mới</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Phase 3 stub — chỉ tạo bản nháp. Mission, ranking, prize sẽ ship ở các
        phase tiếp theo.
      </p>

      <CreateTournamentForm
        courses={myCourses}
        canCreatePlatformWide={admin}
      />
    </main>
  );
}
