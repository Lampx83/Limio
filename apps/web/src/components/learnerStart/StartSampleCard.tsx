import { Clock, PlayCircle } from "lucide-react";
import Link from "next/link";
import type { StartSample } from "@/lib/learnerStart";
import StartSampleButton from "./StartSampleButton";

/**
 * "Thử học ngay" (AC3) gộp với lời nhắn "Bạn chưa ghi danh khoá học nào" thành một khung, một đoạn nói duy nhất ở
 * đầu trang tổng quan của học viên chưa có khoá: hai đoạn riêng nói gần như cùng một ý nên chỉ làm người đọc
 * phải đọc hai lần. Việc cụ thể để làm (học thử) đứng trên cùng vì đo prod 23/10/2026 cho thấy 80% học viên mới
 * bỏ đi do không biết làm gì; lối khác (link mời, danh mục) chỉ là một dòng nhỏ bên dưới.
 * Khi chưa chọn khoá mẫu nào, trang tự dùng lại khung lời nhắn riêng (xem page.tsx).
 */
export default function StartSampleCard({ sample }: { sample: StartSample }) {
  const minutes = sample.firstLesson.durationSec ? Math.max(1, Math.round(sample.firstLesson.durationSec / 60)) : null;

  return (
    <section className="banner-brand mt-6 block rounded-2xl px-5 py-5 sm:px-6" aria-labelledby="start-sample-title">
      <div className="flex items-center gap-3">
        <span className="tool-icon">
          <PlayCircle aria-hidden className="h-5 w-5" />
        </span>
        <h2 id="start-sample-title" className="text-h3">
          Thử học ngay
        </h2>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Bạn chưa ghi danh khoá học nào. Học thử một bài ngắn, làm bài kiểm tra và xem Limio phản hồi bài làm của bạn
        thế nào — Limio sẽ ghi danh miễn phí cho bạn khi bấm “Học thử”.
      </p>

      {/* Tên khoá, bài và nút "Học thử" cùng một hàng: nút nằm cạnh bài mà nó mở. */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-meta text-faint">{sample.title}</p>
          <p className="mt-0.5 text-lg font-semibold leading-snug">{sample.firstLesson.title}</p>
          {minutes && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
              <Clock aria-hidden className="h-4 w-4" />
              Khoảng {minutes} phút
            </p>
          )}
        </div>
        <div className="shrink-0">
          <StartSampleButton courseId={sample.id} courseSlug={sample.slug} lessonId={sample.firstLesson.id} />
        </div>
      </div>

      <p className="mt-4 border-t border-brand-600/20 pt-3 text-sm text-muted">
        Đã có link mời từ giảng viên? Bấm vào link là vào lớp ngay. Hoặc{" "}
        <Link href="/catalog" className="link">
          xem danh mục khoá học
        </Link>
        .
      </p>
    </section>
  );
}
