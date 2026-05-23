import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import ExamWizard from "./ExamWizard";

export const dynamic = "force-dynamic";

export default async function NewExamHubPage({
  searchParams,
}: {
  searchParams?: { courseId?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/instructor/exams/new");
  const userId = session.user.id;

  const ownedCourses = await prisma.course.findMany({
    where: { instructors: { some: { userId } } },
    select: { id: true, title: true, slug: true },
    orderBy: { updatedAt: "desc" },
  });

  if (ownedCourses.length === 0) {
    return (
      <main className="text-center">
        <h1 className="text-2xl font-bold">Tạo đề thi</h1>
        <p className="mt-4 text-sm text-faint">
          Bạn cần là instructor của một khóa học trước khi tạo đề thi.
        </p>
        <Link
          href="/instructor/courses/new"
          className="mt-6 inline-block rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
        >
          + Tạo khóa đầu tiên
        </Link>
      </main>
    );
  }

  const preselectedCourseId =
    searchParams?.courseId && ownedCourses.some((c) => c.id === searchParams.courseId)
      ? searchParams.courseId
      : ownedCourses[0]!.id;

  // Lesson tree for wizard Step 1. Each lesson gets its published bank question count
  // so the UI can show "(N câu sẵn có)" and disable lessons with 0 questions.
  const modules = await prisma.module.findMany({
    where: { courseId: preselectedCourseId },
    orderBy: { orderIndex: "asc" },
    select: {
      id: true,
      title: true,
      lessons: {
        orderBy: { orderIndex: "asc" },
        select: { id: true, title: true },
      },
    },
  });

  const lessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));
  const bankCountsRaw = lessonIds.length > 0
    ? await prisma.$queryRaw<{ lessonId: string; cnt: bigint }[]>`
        SELECT csm."contentId" AS "lessonId", COUNT(DISTINCT bq.id) AS cnt
        FROM "ContentSkillMapping" csm
        JOIN "BankQuestionSkillTag" bqst ON bqst."skillId" = csm."skillId"
        JOIN "BankQuestion" bq ON bq.id = bqst."bankQuestionId" AND bq.status = 'published'
        WHERE csm."contentType" = 'lesson'
          AND csm."contentId" = ANY(${lessonIds})
        GROUP BY csm."contentId"
      `
    : [];
  const bankCountMap = Object.fromEntries(
    bankCountsRaw.map((r) => [r.lessonId, Number(r.cnt)]),
  );

  const lessonTree = modules.map((m) => ({
    id: m.id,
    title: m.title,
    lessons: m.lessons.map((l) => ({
      id: l.id,
      title: l.title,
      bankCount: bankCountMap[l.id] ?? 0,
    })),
  }));

  const userMeta = await prisma.user.findUnique({
    where: { id: userId },
    select: { examsCreatedCount: true, expertAssessmentMode: true },
  });
  const totalBank = Object.values(bankCountMap).reduce((s, n) => s + n, 0);
  const emptyBank = totalBank === 0;
  // If the course has zero bank questions, the Cơ bản wizard (sample-by-lesson)
  // can't produce anything — force Nâng cao mode so user can create an empty
  // exam shell and add questions manually.
  const expertMode = emptyBank ? true : (userMeta?.expertAssessmentMode ?? false);
  const showUpgradeBanner = (userMeta?.examsCreatedCount ?? 0) >= 3 && !expertMode;

  return (
    <main>
      <Link href="/instructor/exams" className="text-sm text-blue-600 hover:underline">
        ← Quản lý đề thi
      </Link>
      <div className="mt-6">
        {emptyBank && (
          <div className="banner-info mb-4 rounded-lg border px-4 py-3 text-sm">
            Khoá học chưa có ngân hàng câu hỏi. Hệ thống đã chuyển sang
            <strong> chế độ Nâng cao</strong> — anh/chị có thể tạo đề thi rỗng
            rồi thêm câu hỏi thủ công, hoặc nhập câu hỏi vào ngân hàng trước.
          </div>
        )}
        <ExamWizard
          courses={ownedCourses}
          initialCourseId={preselectedCourseId}
          lessonTree={lessonTree}
          showUpgradeBanner={showUpgradeBanner}
          initialExpertMode={expertMode}
        />
      </div>
    </main>
  );
}
