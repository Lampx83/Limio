import Link from "next/link";
import { ArrowLeft, ArrowRight, Lock } from "lucide-react";
import { previewHref } from "@/lib/lessonFrameView";
import type { Neighbour } from "@/lib/lessonNeighbours";

type Labels = { prev: string; next: string; locked: string; backToCourse: string; endOfCourse: string };

/**
 * Chân bài: sang bài trước / bài sau. Nằm cuối cột nội dung để học viên đọc hết bài là có ngay lối đi tiếp, không phải mở mục lục.
 * Bài sau đang khoá thì hiện mờ, không có liên kết. Bài cuối khoá thì dẫn về trang khoá học.
 */
export default function LessonPager({
  slug,
  prev,
  next,
  preview,
  labels,
}: {
  slug: string;
  prev: Neighbour | null;
  next: Neighbour | null;
  preview?: boolean;
  labels: Labels;
}) {
  const href = (id: string) => previewHref(`/learn/${slug}/lessons/${id}`, preview);
  const card = "group flex min-w-0 flex-1 flex-col gap-1 rounded-2xl border border-token bg-[rgb(var(--surface))] p-4 shadow-card transition-colors sm:p-5";
  return (
    <nav aria-label="Chuyển bài" data-testid="lesson-pager" className="mt-10 flex flex-col-reverse gap-3 sm:flex-row sm:items-stretch">
      {prev ? (
        <Link href={href(prev.id)} className={`${card} hover:border-brand-300 hover:bg-brand-soft`} rel="prev">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted">
            <ArrowLeft className="h-4 w-4" aria-hidden /> {labels.prev}
          </span>
          <span className="truncate text-base font-semibold">{prev.title}</span>
        </Link>
      ) : (
        <span className="hidden flex-1 sm:block" aria-hidden />
      )}
      {next ? (
        next.locked ? (
          <div className={`${card} cursor-not-allowed text-right opacity-60 sm:items-end`} aria-disabled="true">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted sm:justify-end">
              <Lock className="h-4 w-4" aria-hidden /> {labels.locked}
            </span>
            <span className="truncate text-base font-semibold">{next.title}</span>
          </div>
        ) : (
          <Link href={href(next.id)} className={`${card} border-brand-200 bg-brand-soft text-right hover:border-brand-400 sm:items-end`} rel="next">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 sm:justify-end">
              {labels.next} <ArrowRight className="h-4 w-4" aria-hidden />
            </span>
            <span className="truncate text-base font-semibold">{next.title}</span>
            {next.newModule && <span className="truncate text-sm text-muted">{next.moduleTitle}</span>}
          </Link>
        )
      ) : (
        <Link href={previewHref(`/learn/${slug}`, preview)} className={`${card} border-brand-200 bg-brand-soft text-right hover:border-brand-400 sm:items-end`}>
          <span className="text-sm font-semibold text-brand-700">{labels.endOfCourse}</span>
          <span className="text-base font-semibold">{labels.backToCourse} →</span>
        </Link>
      )}
    </nav>
  );
}
