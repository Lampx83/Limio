import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { CalendarCheck } from "lucide-react";
import { canEditCourse } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import ExamMetaForm from "../ExamMetaForm";
import PublishBar from "./PublishBar";
import ContentManager from "./ContentManager";
import SectionsPanel from "./SectionsPanel";
import CloneButton from "./CloneButton";
import AnalyticsPanel from "./AnalyticsPanel";
import ExamTabs, { parseExamTab } from "./ExamTabs";
import CreatedBanner from "./CreatedBanner";
import BlueprintEditor from "./BlueprintEditor";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  published: "Đã publish",
  archived: "Lưu trữ",
};
const STATUS_TONE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  published: "bg-emerald-100 text-emerald-800",
  archived: "bg-amber-100 text-amber-800",
};

function toLocalInput(d: Date): string {
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

export default async function EditExamPage({
  params,
  searchParams,
}: {
  params: { id: string; examId: string };
  searchParams: { tab?: string; created?: string; fallback?: string };
}) {
  const activeTab = parseExamTab(searchParams?.tab);
  const justCreated = searchParams?.created === "1";
  const fallbackUsed = searchParams?.fallback === "1";
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/signin?callbackUrl=/instructor/courses/${params.id}/exams/${params.examId}`,
    );
  }
  const course = await prisma.course.findUnique({
    where: { id: params.id },
    select: { id: true, title: true },
  });
  if (!course) notFound();
  if (!(await canEditCourse(session.user.id, course.id))) {
    redirect("/instructor/courses");
  }

  const pendingCount = await prisma.examAnswer.count({
    where: {
      needsGrading: true,
      attempt: { examId: params.examId },
      question: { type: { in: ["essay", "short_answer"] } },
    },
  });

  const exam = await prisma.exam.findUnique({
    where: { id: params.examId },
    include: {
      _count: {
        select: {
          passages: true,
          questions: true,
          attempts: true,
        },
      },
      passages: {
        orderBy: { orderIndex: "asc" },
        include: { skillTags: { include: { skill: true } } },
      },
      questions: {
        orderBy: [{ orderInExam: "asc" }],
        include: { skillTags: { include: { skill: true } } },
      },
    },
  });
  if (!exam || exam.courseId !== course.id) notFound();

  const attemptCount = exam._count.attempts;
  const hasAttempts = attemptCount > 0;
  const isPublished = exam.status === "published";
  // After publish + first attempt: title/description/closeAt are still editable
  // server-side (per A7.1.3). Everything else freezes.
  const lockedFields =
    isPublished && hasAttempts
      ? ([
          "durationMin",
          "openAt",
          "passScore",
          "attemptPolicy",
          "gradingMode",
          "proctoringLevel",
          "shuffleQuestions",
          "shuffleOptions",
          "showResultsAfterSubmit",
        ] as const)
      : [];

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href={`/instructor/courses/${course.id}/exams`}
        className="text-sm text-blue-600 hover:underline"
      >
        ← Bài thi
      </Link>

      {justCreated && <div className="mt-4"><CreatedBanner fallback={fallbackUsed} /></div>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{exam.title}</h1>
            <span
              className={`rounded px-2 py-0.5 text-xs ${STATUS_TONE[exam.status] ?? "bg-slate-100"}`}
            >
              {STATUS_LABEL[exam.status] ?? exam.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-faint">
            {exam._count.passages} đoạn · {exam._count.questions} câu hỏi · {attemptCount}{" "}
            lượt thi
          </p>
        </div>

        <div className="flex items-start gap-2">
          <Link
            href={`/instructor/exam-rounds?examId=${exam.id}`}
            className="inline-flex items-center gap-1.5 rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
          >
            <CalendarCheck className="h-4 w-4 shrink-0" /> Tổ chức thi
          </Link>
          <CloneButton examId={exam.id} />
          <PublishBar
            examId={exam.id}
            courseId={course.id}
            status={exam.status}
            hasAttempts={hasAttempts}
          />
        </div>
      </div>

      {isPublished && hasAttempts && (
        <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Đã có {attemptCount} lượt thi. Chỉ tiêu đề và mô tả còn chỉnh sửa
          được. Các trường khác đã khoá để giữ tính công bằng.
        </div>
      )}

      <div className="mt-6">
        <ExamTabs
          courseId={course.id}
          examId={exam.id}
          active={activeTab}
          badges={{
            content: exam.questions.filter((q) => q.skillTags.length === 0)
              .length,
            results: pendingCount,
          }}
        />
      </div>

      {activeTab === "overview" && (
        <div className="mt-6">
          <ExamMetaForm
            mode="edit"
            courseId={course.id}
            examId={exam.id}
            lockedFields={lockedFields}
            initial={{
              title: exam.title,
              description: exam.description ?? "",
              durationMin: exam.durationMin,
              openAt: toLocalInput(exam.openAt),
              closeAt: toLocalInput(exam.closeAt),
              passScore: exam.passScore,
              attemptPolicy: exam.attemptPolicy,
              gradingMode: exam.gradingMode,
              proctoringLevel: exam.proctoringLevel,
              shuffleQuestions: exam.shuffleQuestions,
              shuffleOptions: exam.shuffleOptions,
              showResultsAfterSubmit: exam.showResultsAfterSubmit,
            }}
          />
        </div>
      )}

      {activeTab === "content" && (
        <>
          <SectionsPanel examId={exam.id} />

          <section className="mt-8 rounded border border-default bg-white p-5">
            <h2 className="mb-1 text-base font-semibold">Nội dung bài thi</h2>
            <p className="mb-4 text-sm text-faint">
              {exam.status === "draft"
                ? "Thêm đoạn bài đọc và câu hỏi. Mỗi câu hỏi cần ≥ 1 skill trước khi publish."
                : "Bài thi đã publish; nội dung khoá nếu có lượt thi."}
            </p>
            <ContentManager
              examId={exam.id}
              editable={exam.status === "draft" || attemptCount === 0}
              passages={exam.passages.map((p) => ({
                id: p.id,
                title: p.title,
                contentJson: p.contentJson,
                audioPolicy: p.audioPolicy,
                maxAudioPlays: p.maxAudioPlays,
                revealMode: p.revealMode,
                orderIndex: p.orderIndex,
                skills: p.skillTags.map((t) => ({
                  id: t.skill.id,
                  code: t.skill.code,
                  name: t.skill.name,
                })),
              }))}
              questions={exam.questions.map((q) => ({
                id: q.id,
                type: q.type,
                prompt: q.prompt,
                points: q.points,
                passageId: q.passageId,
                config: q.config as Record<string, unknown>,
                orderInExam: q.orderInExam,
                orderInPassage: q.orderInPassage,
                skills: q.skillTags.map((t) => ({
                  id: t.skill.id,
                  code: t.skill.code,
                  name: t.skill.name,
                })),
              }))}
            />
          </section>
        </>
      )}

      {activeTab === "blueprint" && (
        <BlueprintEditorLoader examId={exam.id} courseId={course.id} />
      )}

      {activeTab === "results" && <AnalyticsPanel examId={exam.id} />}
    </main>
  );
}

async function BlueprintEditorLoader({
  examId,
  courseId,
}: {
  examId: string;
  courseId: string;
}) {
  const [modules, blueprintRow] = await Promise.all([
    prisma.module.findMany({
      where: { courseId },
      orderBy: { orderIndex: "asc" },
      select: {
        id: true,
        title: true,
        lessons: {
          orderBy: { orderIndex: "asc" },
          select: { id: true, title: true },
        },
      },
    }),
    prisma.examBlueprint.findUnique({ where: { examId } }),
  ]);

  const lessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));
  const bankCountsRaw =
    lessonIds.length > 0
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

  return (
    <div className="mt-6">
      <BlueprintEditor
        examId={examId}
        lessonTree={lessonTree}
        initialBlueprint={
          blueprintRow
            ? {
                lessonIds: blueprintRow.lessonIds,
                cells: blueprintRow.cells as { cognitiveLevel: "remember_understand" | "apply" | "analyze_plus"; difficulty: number; count: number }[],
                totalCount: blueprintRow.totalCount,
              }
            : null
        }
      />
    </div>
  );
}
