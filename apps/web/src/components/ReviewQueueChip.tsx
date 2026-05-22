import Link from "next/link";
import { Bell } from "lucide-react";

export default function ReviewQueueChip({
  count,
  hasOverdue,
}: {
  count: number;
  hasOverdue: boolean;
}) {
  return (
    <Link
      href="/me/reviews"
      title={
        hasOverdue
          ? `${count} bài cần chấm — có bài quá hạn`
          : `${count} bài cần chấm`
      }
      aria-label={`${count} bài cần chấm peer review`}
      className={`relative inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all hover:-translate-y-px ${
        hasOverdue
          ? "bg-danger-50 text-danger-700 ring-1 ring-danger-200 hover:bg-danger-100 dark:bg-danger-950/40 dark:text-danger-200"
          : "bg-amber-50 text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-200"
      }`}
    >
      <span className="relative flex">
        <Bell size={14} strokeWidth={2.5} />
        {hasOverdue && (
          <span className="absolute -right-1 -top-1 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger-500 opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-danger-500" />
          </span>
        )}
      </span>
      <span className="hidden sm:inline">Chấm bài ·</span>
      <span>{count}</span>
    </Link>
  );
}
