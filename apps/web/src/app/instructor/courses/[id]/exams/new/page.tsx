import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { canEditCourse } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import ExamMetaForm from "../ExamMetaForm";
import MockTemplatePicker from "../MockTemplatePicker";
import { examCreateChoices, parseExamCreateType } from "@/lib/examCreateType";
import { getAppMode } from "@/lib/appMode.server";

export const dynamic = "force-dynamic";

/** Local datetime string suitable for <input type="datetime-local">. */
function toLocalInput(d: Date): string {
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

export default async function NewExamPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { type?: string | string[] };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=/instructor/courses/${params.id}/exams/new`);
  }
  const course = await prisma.course.findUnique({
    where: { id: params.id },
    select: { id: true, title: true, languageMode: true },
  });
  if (!course) notFound();
  if (!(await canEditCourse(session.user.id, course.id))) {
    redirect("/instructor/courses");
  }
  const now = new Date();
  const inWeek = new Date(now.getTime() + 7 * 24 * 60 * 60_000);

  // LANG L4.1 — bước đầu: chọn LOẠI đề (cố định sau khi tạo).
  const type = parseExamCreateType(searchParams?.type);
  if (type === null) {
    const choices = examCreateChoices({ courseLanguageMode: course.languageMode, appMode: getAppMode() });
    return (
      <main>
        <Link
          href={`/instructor/courses/${course.id}/exams`}
          className="text-sm font-medium text-lime-700 hover:text-lime-800 hover:underline dark:text-lime-400 dark:hover:text-lime-300"
        >
          ← Bài thi
        </Link>
        <h1 className="mt-3 text-2xl font-bold">Tạo đề thi mới</h1>
        <p className="mt-1 text-sm text-faint">Chọn loại đề. Loại đề không đổi được sau khi tạo.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2" role="list">
          {choices.map((c) => (
            <Link
              key={c.type}
              role="listitem"
              href={`/instructor/courses/${course.id}/exams/new?${c.query}`}
              className={`rounded-xl border p-5 transition-shadow hover:shadow-md ${
                c.recommended ? "border-emerald-400 bg-emerald-50" : "border-token bg-[rgb(var(--surface))]"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">{c.title}</span>
                {c.recommended && <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">Gợi ý</span>}
              </div>
              <p className="mt-2 text-sm text-muted">{c.description}</p>
            </Link>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main>
      <Link
        href={`/instructor/courses/${course.id}/exams/new`}
        className="text-sm font-medium text-lime-700 hover:text-lime-800 hover:underline dark:text-lime-400 dark:hover:text-lime-300"
      >
        ← Chọn loại đề
      </Link>
      <h1 className="mt-3 text-2xl font-bold">{type === "language" ? "Tạo đề thi ngoại ngữ" : "Tạo bài thi mới"}</h1>
      <p className="mt-1 text-sm text-faint">
        {type === "language"
          ? "Chọn khung đề rồi đặt tên. Sau khi tạo, bạn thêm phần, giờ, bài đọc và câu hỏi."
          : "Bước 1 trong 3 — đặt thông số bài thi. Sau khi tạo, bạn sẽ thêm đoạn bài đọc và câu hỏi."}
      </p>

      {type === "language" ? (
        <MockTemplatePicker courseId={course.id} />
      ) : (
        <div className="mt-6">
          <ExamMetaForm
            mode="create"
            courseId={course.id}
            fixedKind="written"
            initial={{
              title: "",
              description: "",
              durationMin: 60,
              openAt: toLocalInput(now),
              closeAt: toLocalInput(inWeek),
              attemptPolicy: "single",
              gradingMode: "hybrid",
              proctoringLevel: "basic",
              shuffleQuestions: true,
              shuffleOptions: true,
              showResultsAfterSubmit: true,
              purpose: "assessment",
            }}
          />
        </div>
      )}
    </main>
  );
}
