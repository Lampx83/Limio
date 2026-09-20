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
  const myCourses = await prisma.course.findMany({
    where: admin ? {} : { instructors: { some: { userId } } },
    orderBy: { title: "asc" },
    select: { id: true, title: true },
  });

  if (!admin && myCourses.length === 0) {
    return (
      <main>
        <div className="rounded-2xl border border-danger-100 bg-danger-50 p-5 text-sm text-danger-700">
          Bạn không phải instructor của khóa nào. Chỉ instructor hoặc admin
          mới tạo được đấu trường.
        </div>
      </main>
    );
  }

  return (
    <main>
      <Link
        href="/instructor/courses"
        className="link inline-flex items-center gap-1 text-sm"
      >
        ← Khóa của tôi
      </Link>

      <div className="mt-4">
        <span className="chip-accent">Đấu trường</span>
        <h1 className="mt-3 text-2xl font-bold">
          Tạo đấu trường mới
        </h1>
        <p className="mt-2 text-muted">
          Phase 3 stub — chỉ tạo bản nháp. Mission, ranking, prize sẽ ship ở các
          phase tiếp theo.
        </p>
      </div>

      <div className="mt-8">
        <CreateTournamentForm
          courses={myCourses}
          canCreatePlatformWide={admin}
        />
      </div>
    </main>
  );
}
