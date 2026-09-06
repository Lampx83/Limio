"use client";

import { useEffect, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";

/**
 * Thanh điều hướng cố định dưới đáy trang bài học: bài trước — mục lục khoá —
 * bài tiếp, kèm huy hiệu đã hoàn thành.
 *
 * Hai nút điều hướng dùng kiểu nút đặc chứ không phải chữ mờ: đây là thao tác
 * người học làm nhiều nhất trên trang, mà bản cũ để chúng cùng màu với chữ phụ
 * nên gần như tàng hình trên nền sáng. Nút "bài tiếp" nổi hơn "bài trước" —
 * cùng nổi như nhau thì lại không còn hướng đi mặc định nào.
 *
 * Việc tự đánh dấu hoàn thành nằm ở LessonCompletionPrompt (đầu trang) để
 * phần theo dõi và lời gọi API có đúng một chủ. Ở đây chỉ giữ nhịp tim
 * lesson-view, bắn một lần lúc mount để máy chủ ghi lastLessonId /
 * lastPositionSec cho tính năng "học tiếp chỗ đang dở".
 */
export default function LessonStickyActions({
  lessonId,
  courseSlug,
  completed,
  initialResumeSec,
  prevLessonId,
  prevTitle,
  nextLessonId,
  nextTitle,
  toc,
}: {
  lessonId: string;
  courseSlug: string;
  completed: boolean;
  initialResumeSec: number;
  prevLessonId: string | null;
  prevTitle: string | null;
  nextLessonId: string | null;
  nextTitle: string | null;
  /** Nút mở mục lục khoá học — truyền từ trang để dùng chung một drawer với đầu trang. */
  toc?: ReactNode;
}) {
  useEffect(() => {
    fetch(apiUrl(`/api/lessons/${lessonId}/view`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ positionSec: initialResumeSec }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  return (
    <>
      {/* Chừa chỗ để nội dung cuối trang không nằm dưới thanh cố định */}
      <div aria-hidden className="h-28" />

      {/*
        Nền của thanh này KHÁC nền trang (một lớp lime nhạt) chứ không cùng màu
        trắng: nó nổi lên trên nội dung, nên nếu cùng màu thì lúc cuộn qua một
        khối trắng, mép thanh biến mất và các nút trông như đang nằm giữa bài.
        Kèm viền trên đậm hơn và bóng hắt lên để thấy rõ đây là tầng nổi.
      */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-brand-300 bg-brand-100 shadow-[0_-8px_24px_-14px_rgba(0,0,0,0.4)] pb-[env(safe-area-inset-bottom)] dark:border-brand-800 dark:bg-[rgb(var(--brand-soft))] print:hidden">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4">
          {prevLessonId ? (
            <a
              href={`/learn/${courseSlug}/lessons/${prevLessonId}`}
              title={prevTitle ?? undefined}
              aria-label={prevTitle ? `Bài trước: ${prevTitle}` : "Bài trước"}
              className="btn btn-secondary min-w-0 shrink-0 sm:max-w-[15rem]"
            >
              <ArrowLeft size={16} className="shrink-0" />
              <span className="hidden sm:inline">Bài trước</span>
            </a>
          ) : (
            <span aria-hidden className="w-0 shrink-0 sm:w-28" />
          )}

          <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
            {toc}
            {completed && (
              <span className="hidden items-center gap-1.5 rounded-lg bg-success-50 px-3 py-1.5 text-sm font-semibold text-success-700 md:inline-flex">
                <Check size={14} strokeWidth={2.5} />
                Đã hoàn thành
              </span>
            )}
          </div>

          {nextLessonId ? (
            <a
              href={`/learn/${courseSlug}/lessons/${nextLessonId}`}
              title={nextTitle ?? undefined}
              aria-label={nextTitle ? `Bài tiếp: ${nextTitle}` : "Bài tiếp"}
              className="btn btn-primary min-w-0 shrink-0 sm:max-w-[18rem]"
            >
              {/* Tên bài kế tiếp hiện ở màn rộng: biết mình đang đi đâu thì
                  quyết định bấm tiếp hay dừng lại dễ hơn hẳn một mũi tên trống. */}
              <span className="hidden sm:inline">Bài tiếp</span>
              {nextTitle && (
                <span className="hidden max-w-[10rem] truncate font-normal opacity-90 lg:inline">
                  · {nextTitle}
                </span>
              )}
              <ArrowRight size={16} className="shrink-0" />
            </a>
          ) : (
            <span
              aria-hidden
              className="w-0 shrink-0 sm:w-28"
              data-note="bài cuối khoá: không có nút tiếp"
            />
          )}
        </div>
      </div>
    </>
  );
}
