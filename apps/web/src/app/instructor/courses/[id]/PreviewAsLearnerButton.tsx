import Link from "next/link";
import { ExternalLink } from "lucide-react";

/**
 * "Xem như học viên": mở trang bài học THẬT của học viên ở tab mới, chỉ còn tên
 * bài và nội dung (`preview=1` bỏ các nút điều hướng/công cụ khác). Trang soạn còn nguyên.
 *
 * Bài đang ẩn thì trang học viên trả 404 (đúng như học viên gặp), nên nút bị
 * vô hiệu kèm lý do thay vì mở ra một trang lỗi.
 */
export default function PreviewAsLearnerButton({
  courseSlug,
  lessonId,
  hidden,
}: {
  courseSlug: string;
  lessonId: string;
  hidden: boolean;
}) {
  const cls =
    "inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-token bg-[rgb(var(--surface))] px-3 py-1.5 text-sm font-medium";

  if (hidden) {
    return (
      <span
        aria-disabled="true"
        title="Bài đang ẩn với học viên nên không có gì để xem. Bật lại ở menu ⋮ → Hiện bài này."
        className={`${cls} cursor-not-allowed text-faint opacity-60`}
      >
        <ExternalLink className="h-4 w-4" aria-hidden />
        Xem như học viên
      </span>
    );
  }

  return (
    <Link
      href={`/learn/${courseSlug}/lessons/${lessonId}?preview=1`}
      target="_blank"
      rel="noopener"
      prefetch={false}
      title="Mở riêng bài này (chỉ tên bài và nội dung) trong tab mới"
      className={`${cls} text-[rgb(var(--text))] transition-colors hover:border-brand-300 hover:bg-brand-soft hover:text-brand-700`}
    >
      <ExternalLink className="h-4 w-4" aria-hidden />
      Xem như học viên
    </Link>
  );
}
