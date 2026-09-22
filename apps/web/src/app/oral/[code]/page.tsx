import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { ExamError, joinOralSessionByCode, resolveOralJoinCode } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { detectInAppBrowser } from "@/lib/inAppBrowser";
import InAppBrowserNotice from "@/components/InAppBrowserNotice";

export const dynamic = "force-dynamic";

/**
 * A6.5 (rewrite) — vào thẳng một buổi vấn đáp bằng mã tham gia, KHÔNG qua
 * trang khoá học. Vẫn yêu cầu đăng nhập (User thật, không phải ExamCandidate
 * ẩn danh như /exam/[code] của thi viết) nhưng bỏ qua Enrollment — hợp với
 * lớp mời ngoài không quản lý qua ghi danh. Xem joinOralSessionByCode.
 */
export default async function OralJoinByCodePage({
  params,
  searchParams,
}: {
  params: { code: string };
  searchParams?: { retake?: string };
}) {
  // ?retake=1 chỉ do nút "Thi lại" tạo ra — mở lại link/refresh không tự đốt lượt.
  const retake = searchParams?.retake === "1";
  const code = params.code.toUpperCase();
  const session = await auth();
  if (!session?.user?.id) {
    // Đăng nhập Google chắc chắn thất bại trong webview của Zalo/Messenger/...
    // — chặn ở đây và hướng dẫn mở trình duyệt thật thay vì đá vào /signin để
    // rồi thất bại lặp lại vô ích. Xem lib/inAppBrowser.ts.
    const embedded = detectInAppBrowser(headers().get("user-agent"));
    if (embedded) {
      return (
        <main className="mx-auto max-w-md px-4 py-16">
          <InAppBrowserNotice appName={embedded.appName} />
        </main>
      );
    }
    redirect(`/signin?callbackUrl=/oral/${code}`);
  }

  const info = await resolveOralJoinCode(code);
  if (!info) notFound();

  // "none" — đề không gắn khoá học (đề độc lập): route /learn/[slug]/... không
  // dùng slug để tra course ở đây (chỉ để build link điều hướng khác), nên
  // sentinel này an toàn — không phải slug thật, không tra cứu.
  const courseSlug = info.courseSlug ?? "none";

  if (!info.isOpen) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="mb-2 text-xl font-semibold">Buổi vấn đáp đã đóng</h1>
        <p className="text-sm text-faint">
          {info.examTitle} — {info.courseTitle ?? "Đề độc lập"}. Liên hệ giảng
          viên nếu bạn cần vào lại.
        </p>
        <a href="/" className="mt-6 inline-block text-sm font-medium text-lime-700 hover:text-lime-800 hover:underline dark:text-lime-400 dark:hover:text-lime-300">
          ← Trang chủ
        </a>
      </main>
    );
  }

  try {
    const r = await joinOralSessionByCode(session.user.id, code, { retake });
    redirect(`/learn/${courseSlug}/exams/${r.examId}/oral/${r.attemptId}`);
  } catch (e) {
    if (e instanceof ExamError) {
      if (e.code === "attempt_already_submitted" || e.code === "attempt_limit_reached") {
        const existing = await prisma.examAttempt.findFirst({
          where: { examId: info.examId, userId: session.user.id },
          orderBy: { startedAt: "desc" },
          select: { id: true },
        });
        if (existing) {
          redirect(
            `/learn/${courseSlug}/exams/${info.examId}/oral/${existing.id}/submitted`,
          );
        }
      }
      return (
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="mb-2 text-xl font-semibold">Không vào được buổi vấn đáp</h1>
          <p className="text-sm text-faint">{describeError(e.code)}</p>
          <a href="/" className="mt-6 inline-block text-sm font-medium text-lime-700 hover:text-lime-800 hover:underline dark:text-lime-400 dark:hover:text-lime-300">
            ← Trang chủ
          </a>
        </main>
      );
    }
    throw e;
  }
}

function describeError(code: string): string {
  switch (code) {
    case "invalid_code":
      return "Mã tham gia không hợp lệ.";
    case "exam_window_closed":
      return "Buổi vấn đáp đã đóng.";
    case "attempt_limit_reached":
      return "Bạn đã dùng hết số lượt vấn đáp cho phép.";
    default:
      return `Lỗi: ${code}`;
  }
}
