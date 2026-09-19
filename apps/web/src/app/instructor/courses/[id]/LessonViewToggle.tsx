"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Eye, X } from "lucide-react";

/**
 * Nút vào/thoát chế độ xem trước của bài. Là NÚT có động từ chứ không phải
 * công tắc: "Xem như học viên" để vào, "Thoát xem trước" để quay lại soạn bài.
 * Trạng thái nằm trong URL (`lessonView=preview`) nên tải lại trang hay gửi
 * link vẫn giữ nguyên chế độ.
 */
export default function LessonViewToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const previewing = search.get("lessonView") === "preview";

  function go() {
    const params = new URLSearchParams(search.toString());
    if (previewing) params.delete("lessonView");
    else params.set("lessonView", "preview");
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <button
      type="button"
      data-view-keep
      onClick={go}
      title={
        previewing
          ? "Quay lại chế độ soạn bài"
          : "Xem bài đúng như học viên sẽ thấy (các nút sửa sẽ ẩn)"
      }
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
        previewing
          ? "border-lime-600 bg-lime-600 text-white hover:bg-lime-700"
          : "border-token bg-[rgb(var(--surface))] text-[rgb(var(--text))] hover:border-brand-300 hover:bg-brand-soft hover:text-brand-700"
      }`}
    >
      {previewing ? (
        <X className="h-4 w-4" aria-hidden />
      ) : (
        <Eye className="h-4 w-4" aria-hidden />
      )}
      {previewing ? "Thoát xem trước" : "Xem như học viên"}
    </button>
  );
}
