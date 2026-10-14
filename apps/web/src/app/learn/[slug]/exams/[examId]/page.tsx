import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import {
  ExamError,
  isUserEnrolled,
  startExamAttempt,
  startOralExamAttempt,
} from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import ExamPreRoom from "@/components/exam/ExamPreRoom";
import ExamRoomChrome from "@/components/exam/ExamRoomChrome";

export const dynamic = "force-dynamic";

/**
 * Entry point for taking an exam. Starts/resumes an attempt server-side and
 * redirects to the per-attempt runtime URL. We rely on startExamAttempt being
 * idempotent w.r.t. resuming an in-progress attempt — so re-hitting this URL
 * never creates a second attempt.
 */
export default async function ExamLandingPage({
  params,
  searchParams,
}: {
  params: { slug: string; examId: string };
  searchParams?: { retake?: string };
}) {
  // ?retake=1 chỉ do nút "Thi lại" ở trang đã nộp tạo ra — mở lại link/refresh thì không tự đốt lượt (xem decideOralStart).
  const retake = searchParams?.retake === "1";
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=/learn/${params.slug}/exams/${params.examId}`);
  }
  const course = await prisma.course.findUnique({
    where: { slug: params.slug },
    select: { id: true },
  });
  if (!course) notFound();
  if (!(await isUserEnrolled(session.user.id, course.id))) {
    redirect(`/catalog/${params.slug}`);
  }

  // Server-side validation: exam must exist and belong to this course.
  const exam = await prisma.exam.findUnique({
    where: { id: params.examId },
    select: { id: true, courseId: true, title: true, status: true, kind: true, mockMode: true, allowMock: true },
  });
  if (!exam || exam.courseId !== course.id) notFound();

  // A6.3 — Vấn đáp AI không có ExamQuestion/shuffle/sessionToken query-param
  // như thi viết, nên đi luồng bắt đầu riêng và runtime URL riêng (/oral/...).
  if (exam.kind === "oral") {
    try {
      const r = await startOralExamAttempt(session.user.id, params.examId, { retake });
      redirect(`/learn/${params.slug}/exams/${params.examId}/oral/${r.attemptId}`);
    } catch (e) {
      if (e instanceof ExamError) {
        if (e.code === "attempt_already_submitted" || e.code === "attempt_limit_reached") {
          const existing = await prisma.examAttempt.findFirst({
            where: { examId: exam.id, userId: session.user.id },
            orderBy: { startedAt: "desc" },
            select: { id: true },
          });
          if (existing) {
            redirect(
              `/learn/${params.slug}/exams/${params.examId}/oral/${existing.id}/submitted`,
            );
          }
        }
        return (
          <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6 text-center">
            <h1 className="mb-4 text-2xl font-semibold">Không thể bắt đầu buổi vấn đáp</h1>
            <p className="text-faint">{describeExamError(e.code)}</p>
          </main>
        );
      }
      throw e;
    }
  }

  // LANG G5c.5 — đề thi thử: màn trước phòng thi (luật, thử loa, "Tôi đã sẵn sàng"); đồng hồ
  // chỉ chạy khi học viên xác nhận. Đang có lượt dở thì vào thẳng (tiếp tục), đã nộp mà không
  // có ?retake=1 thì sang kết quả — mở lại link/F5 không tự đốt lượt.
  if (exam.mockMode && exam.status === "published") {
    const attempts = await prisma.examAttempt.findMany({
      where: { examId: exam.id, userId: session.user.id },
      orderBy: { startedAt: "desc" },
      select: { id: true, status: true },
    });
    const inProgress = attempts.find((a) => a.status === "in_progress");
    if (!inProgress) {
      if (attempts.length > 0 && !retake) {
        redirect(`/learn/${params.slug}/exams/${params.examId}/${attempts[0]!.id}/result`);
      }
      if (!exam.allowMock) {
        return (
          <main className="mx-auto max-w-3xl px-4 py-8 text-center">
            <h1 className="mb-3 text-2xl font-semibold">Thi thử đang tạm đóng</h1>
            <p className="text-faint">Giảng viên đã tạm tắt thi thử cho đề này.</p>
          </main>
        );
      }
      const [sections, passages] = await Promise.all([
        prisma.examSection.findMany({
          where: { examId: exam.id },
          orderBy: { orderIndex: "asc" },
          select: { title: true, languageSkill: true, durationMin: true },
        }),
        prisma.examPassage.findMany({
          where: { examId: exam.id },
          select: { contentJson: true, audioPolicy: true, maxAudioPlays: true },
        }),
      ]);
      const audioPassages = passages.filter((p) => JSON.stringify(p.contentJson).includes('"type":"audio"'));
      const once = audioPassages.some((p) => p.audioPolicy === "once_only");
      const limited = audioPassages.filter((p) => p.audioPolicy === "limited_replay");
      const audioRule = once
        ? "Bài nghe chỉ phát MỘT lần: không tua, không dừng, không nghe lại."
        : limited.length > 0
          ? `Bài nghe chỉ được phát tối đa ${Math.min(...limited.map((p) => p.maxAudioPlays ?? 1))} lần (mỗi lần nghe từ đầu, không tua).`
          : null;
      return (
        <>
          <ExamRoomChrome />
          <ExamPreRoom
            slug={params.slug}
            examId={exam.id}
            title={exam.title}
            sections={sections.map((s) => ({ title: s.title, languageSkill: s.languageSkill, durationMin: s.durationMin ?? 0 }))}
            hasAudio={audioPassages.length > 0}
            audioRule={audioRule}
            retake={retake}
            attemptNo={attempts.length + 1}
          />
        </>
      );
    }
  }

  try {
    const r = await startExamAttempt(session.user.id, params.examId);
    redirect(
      `/learn/${params.slug}/exams/${params.examId}/${r.attemptId}?st=${encodeURIComponent(r.sessionToken)}`,
    );
  } catch (e) {
    if (e instanceof ExamError) {
      // Already submitted → jump to result. Other failures bubble up as UI.
      if (e.code === "attempt_already_submitted") {
        const existing = await prisma.examAttempt.findFirst({
          where: { examId: exam.id, userId: session.user.id },
          orderBy: { startedAt: "desc" },
          select: { id: true },
        });
        if (existing) {
          redirect(
            `/learn/${params.slug}/exams/${params.examId}/${existing.id}/result`,
          );
        }
      }
      return (
        <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6 text-center">
          <h1 className="mb-4 text-2xl font-semibold">Không thể bắt đầu bài thi</h1>
          <p className="text-faint">{describeExamError(e.code)}</p>
        </main>
      );
    }
    throw e;
  }
}

function describeExamError(code: string): string {
  switch (code) {
    case "exam_not_open":
      return "Bài thi chưa mở.";
    case "exam_window_closed":
      return "Bài thi đã đóng.";
    case "attempt_limit_reached":
      return "Bạn đã dùng hết số lượt thi cho phép.";
    case "not_enrolled":
      return "Bạn chưa đăng ký khóa học này.";
    default:
      return `Lỗi: ${code}`;
  }
}
