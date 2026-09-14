import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { canEditCourse } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import ExamMetaForm from "../ExamMetaForm";
import PublishBar from "./PublishBar";
import ContentManager from "./ContentManager";
import SectionsPanel from "./SectionsPanel";
import OralMaterialsPanel from "./OralMaterialsPanel";
import ExamTabs, { parseExamTab } from "./ExamTabs";
import CreatedBanner from "./CreatedBanner";

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
  const requestedTab = parseExamTab(searchParams?.tab);
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

  const exam = await prisma.exam.findUnique({
    where: { id: params.examId },
    include: {
      _count: {
        select: {
          passages: true,
          questions: true,
          attempts: true,
          oralMaterials: true,
        },
      },
      passages: {
        orderBy: { orderIndex: "asc" },
        include: { skillTags: { include: { skill: true } } },
      },
      questions: {
        orderBy: [{ orderInExam: "asc" }],
        include: {
          skillTags: { include: { skill: true } },
          // Join về BankQuestion để hiển thị mã gốc (vd KNM-0042) khi câu hỏi
          // copy/import từ ngân hàng. 1:1 unique FK → cost negligible.
          fromBank: {
            select: { bankQuestion: { select: { code: true } } },
          },
          // Phần (ExamSection) câu hỏi này thuộc về, nếu đề đã chia nhiều
          // phần — ContentManager dùng để nhóm hiển thị theo khung.
          sectionItem: { select: { sectionId: true } },
        },
      },
    },
  });
  if (!exam || exam.courseId !== course.id) notFound();

  const hasContent =
    exam.kind === "oral"
      ? exam._count.oralMaterials > 0
      : exam._count.passages > 0 || exam._count.questions > 0;

  // A6.1 — exam.kind bất biến sau khi tạo: mỗi đề chỉ dùng MỘT trong hai tab
  // content/materials. Tab không hợp lệ với kind hiện tại (vd link cũ còn
  // ?tab=content trên một đề đã là oral) rơi về tab tương ứng, không lỗi.
  const activeTab =
    exam.kind === "oral" && requestedTab === "content"
      ? "materials"
      : exam.kind === "written" && requestedTab === "materials"
        ? "content"
        : requestedTab;

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
          "attemptPolicy",
          "gradingMode",
          "proctoringLevel",
          "shuffleQuestions",
          "shuffleOptions",
          "showResultsAfterSubmit",
        ] as const)
      : [];

  return (
    <main>
      <Link
        href={`/instructor/courses/${course.id}/exams`}
        className="text-sm text-blue-600 hover:underline"
      >
        ← Bài thi
      </Link>

      {justCreated && (
        <div className="mt-4">
          <CreatedBanner fallback={fallbackUsed} hasContent={hasContent} kind={exam.kind} />
        </div>
      )}
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
            {exam.kind === "oral" ? (
              <>{exam._count.oralMaterials} tài liệu</>
            ) : (
              <>
                {exam._count.passages} đoạn · {exam._count.questions} câu hỏi
              </>
            )}{" "}
            · {attemptCount} lượt thi
          </p>
        </div>

        <div className="flex items-start gap-2">
          <PublishBar examId={exam.id} status={exam.status} />
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
          kind={exam.kind}
          badges={{
            content: exam.questions.filter((q) => q.skillTags.length === 0)
              .length,
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
              attemptPolicy: exam.attemptPolicy,
              gradingMode: exam.gradingMode,
              proctoringLevel: exam.proctoringLevel,
              shuffleQuestions: exam.shuffleQuestions,
              shuffleOptions: exam.shuffleOptions,
              showResultsAfterSubmit: exam.showResultsAfterSubmit,
              purpose: exam.purpose,
              kind: exam.kind,
              answerMode: exam.answerMode,
            }}
          />
        </div>
      )}

      {activeTab === "materials" && (
        <div className="mt-6">
          <OralMaterialsPanel
            examId={exam.id}
            editable={exam.status === "draft"}
          />
        </div>
      )}

      {activeTab === "content" && (
        <>
          <section className="mt-6 rounded border border-default bg-white p-5">
            <h2 className="mb-1 text-base font-semibold">Nội dung bài thi</h2>
            <p className="mb-4 text-sm text-faint">
              {exam.status === "archived"
                ? "Bài thi đã lưu trữ — nội dung khoá, không sửa được."
                : "Thêm câu hỏi từ ngân hàng, hoặc tự soạn. Mỗi câu hỏi cần ≥ 1 skill trước khi publish."}
            </p>
            {isPublished && hasAttempts && (
              <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                ⚠ Đề đã có {attemptCount} lượt thi. Sửa nội dung/đáp án câu hỏi có
                thể làm điểm & đáp án của các bài đã nộp không còn khớp — cân nhắc
                chấm lại nếu cần.
              </div>
            )}
            <ContentManager
              examId={exam.id}
              editable={exam.status !== "archived"}
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
                bankCode: q.fromBank?.bankQuestion.code ?? null,
                sectionId: q.sectionItem?.sectionId ?? null,
                skills: q.skillTags.map((t) => ({
                  id: t.skill.id,
                  code: t.skill.code,
                  name: t.skill.name,
                })),
              }))}
            />
          </section>

          <SectionsPanel examId={exam.id} />
        </>
      )}
    </main>
  );
}
