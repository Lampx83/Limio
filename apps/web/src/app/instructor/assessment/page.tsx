import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { CalendarCheck, Check, FlaskConical, Library } from "lucide-react";
import { auth } from "@/lib/auth";
import { computeAssessmentSteps, type StepKey, type StepStatus } from "@/lib/assessmentSteps";

export const dynamic = "force-dynamic";

/**
 * Bắt đầu — ba bước của kiểm tra đánh giá theo đúng thứ tự làm việc:
 * soạn câu hỏi → gom thành đề thi → tổ chức thi. Menu chỉ liệt kê ba mục cạnh nhau
 * nên giảng viên mới không biết đi từ đâu; trang này nói bước nào đã xong, bước nào
 * làm tiếp.
 */
export default async function AssessmentStartPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/instructor/assessment");
  const userId = session.user.id;

  const myCourses = { instructors: { some: { userId } } };
  const [publishedQuestions, publishedExams, draftExams, sessions, banks] = await Promise.all([
    prisma.bankQuestion.count({
      where: {
        status: "published",
        bank: { OR: [{ ownerUserId: userId }, { course: myCourses }] },
      },
    }),
    prisma.exam.count({ where: { kind: "written", status: "published", course: myCourses } }),
    prisma.exam.count({ where: { kind: "written", status: "draft", course: myCourses } }),
    // Không tính ca mặc định do hệ thống tự dựng khi publish: đó chưa phải "đã tổ chức".
    prisma.examSession.count({
      where: { exam: { course: myCourses }, NOT: { code: "CA-DEFAULT" } },
    }),
    prisma.questionBank.count({ where: { OR: [{ ownerUserId: userId }, { course: myCourses }] } }),
  ]);

  const { steps, next } = computeAssessmentSteps({
    publishedQuestions,
    publishedExams,
    draftExams,
    sessions,
  });

  const META: Record<
    StepKey,
    { n: number; title: string; blurb: string; href: string; cta: string; icon: React.ReactNode; stat: string }
  > = {
    bank: {
      n: 1,
      title: "Ngân hàng câu hỏi",
      blurb: "Đây là nơi lưu các câu hỏi của bạn. Bạn soạn hoặc nhập câu hỏi một lần, sau đó có thể dùng lại cho nhiều đề thi khác nhau. Nếu bạn muốn soạn câu hỏi trực tiếp trong đề thi thì có thể bỏ qua bước này.",
      href: "/instructor/question-banks",
      cta: publishedQuestions > 0 ? "Mở ngân hàng" : "Tạo ngân hàng câu hỏi",
      icon: <Library className="h-5 w-5" aria-hidden />,
      stat: `${banks} ngân hàng · ${publishedQuestions} câu đã publish`,
    },
    exam: {
      n: 2,
      title: "Thiết kế đề thi",
      blurb: "Ở bước này bạn tạo đề thi, tức là bộ câu hỏi thí sinh sẽ làm. Bạn chọn câu hỏi từ ngân hàng hoặc tự soạn thêm, đặt thời gian làm bài và cách chấm điểm, rồi bấm Publish để đề sẵn sàng đưa vào tổ chức thi.",
      href: "/instructor/exams",
      cta: publishedExams + draftExams > 0 ? "Mở danh sách đề" : "Tạo đề thi",
      icon: <FlaskConical className="h-5 w-5" aria-hidden />,
      stat: `${publishedExams} đề đã publish · ${draftExams} đề nháp`,
    },
    organize: {
      n: 3,
      title: "Tổ chức thi",
      blurb: "Bạn chọn đề thi, rồi quyết định thi vào lúc nào, kéo dài bao lâu và những ai được vào thi. Bạn có thể tạo nhanh một đường link cho thí sinh vào làm bài, cho học viên làm thử để kiểm tra chất lượng câu hỏi, hoặc lập một đợt thi chính thức gồm nhiều ca có giám thị.",
      href: "/instructor/organize",
      cta: sessions > 0 ? "Mở Tổ chức thi" : "Tổ chức buổi thi đầu tiên",
      icon: <CalendarCheck className="h-5 w-5" aria-hidden />,
      stat: `${sessions} buổi/ca thi đã tổ chức`,
    },
  };

  const STATUS_BADGE: Record<StepStatus, { text: string; cls: string } | null> = {
    done: { text: "Đã xong", cls: "bg-emerald-100 text-emerald-800" },
    current: { text: "Làm tiếp bước này", cls: "bg-brand-100 text-brand-800" },
    waiting: { text: "Chưa tới bước này", cls: "bg-slate-100 text-slate-500" },
    skipped: { text: "Có thể bỏ qua", cls: "bg-slate-100 text-slate-600" },
  };

  return (
    <main>
      <h1 className="text-2xl font-bold">Kiểm tra đánh giá</h1>
      <p className="mt-1 text-body text-faint">
        Ba bước theo thứ tự: soạn câu hỏi → gom thành đề thi → tổ chức thi.
        {next === "done"
          ? " Bạn đã đi đủ cả ba bước — quay lại bất kỳ bước nào để làm thêm."
          : ""}
      </p>

      <ol className="mt-6 space-y-4">
        {steps.map((s) => {
          const m = META[s.key];
          const badge = STATUS_BADGE[s.status];
          const isCurrent = s.status === "current";
          return (
            <li
              key={s.key}
              data-testid={`assessment-step-${s.key}`}
              className={`rounded-xl border bg-white p-4 shadow-sm ${
                isCurrent ? "border-brand-400" : "border-default"
              } ${s.status === "waiting" ? "opacity-70" : ""}`}
            >
              <div className="flex flex-wrap items-start gap-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                    s.status === "done"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-brand-50 text-brand-700"
                  }`}
                  aria-hidden
                >
                  {s.status === "done" ? <Check className="h-4 w-4" /> : m.n}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold">
                    {m.icon}
                    <span>
                      Bước {m.n}: {m.title}
                    </span>
                    {badge && (
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
                        {badge.text}
                      </span>
                    )}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">{m.blurb}</p>
                  <p className="mt-1 text-xs text-faint">{m.stat}</p>
                  {s.hint && <p className="mt-1 text-xs text-amber-700">{s.hint}</p>}
                </div>
                <Link
                  href={m.href}
                  className={`shrink-0 rounded px-3 py-1.5 text-sm font-medium ${
                    isCurrent
                      ? "bg-brand-600 text-white hover:bg-brand-700"
                      : "border border-default bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {m.cta} →
                </Link>
              </div>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
