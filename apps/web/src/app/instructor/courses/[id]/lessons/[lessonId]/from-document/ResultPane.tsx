"use client";

import { AlertTriangle, Check, CircleDashed, Loader2 } from "lucide-react";
import type { LessonDraftResult, LessonLook } from "@feedbackme/shared-types";
import LessonRichText from "@/components/lesson/LessonRichText";

export interface GenStep {
  label: string;
  ok: boolean | null;
}

/** Tiến độ khi AI đang viết: thanh phần trăm và từng mục (T5). */
export function GenerationView({ steps, total, writing }: { steps: GenStep[]; total: number; writing: string }) {
  const done = steps.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="mx-auto max-w-3xl px-3 py-6 sm:px-6">
      <div className="rounded-2xl bg-[rgb(var(--surface))] p-5 shadow-sm sm:p-6" aria-live="polite">
        <h2 className="text-h3">AI đang viết bài theo dàn ý đã chốt</h2>
        <p className="mt-1 text-sm text-muted">
          {writing}. Có thể mất vài phút với bài nhiều mục; bài viết xong được lưu lại, rời trang vẫn không mất.
        </p>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[rgb(var(--surface-muted))]">
          <div className="h-full rounded-full bg-brand-600 transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1.5 text-right text-xs tabular-nums text-faint">
          {done}/{total}
        </p>
        <ul className="mt-2 space-y-1">
          {steps.map((s, i) => (
            <li key={i} className="flex items-center gap-2.5 text-sm">
              {s.ok ? (
                <Check className="h-4 w-4 text-brand-600" aria-hidden />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />
              )}
              <span>{s.label}</span>
              {!s.ok && <span className="text-xs text-amber-700">dùng nguyên đoạn tài liệu</span>}
            </li>
          ))}
          {done < total && (
            <li className="flex items-center gap-2.5 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin text-brand-600" aria-hidden />
              Đang viết…
            </li>
          )}
          {Array.from({ length: Math.max(0, total - done - 1) }).map((_, i) => (
            <li key={`w${i}`} className="flex items-center gap-2.5 text-sm text-faint">
              <CircleDashed className="h-4 w-4" aria-hidden />
              Chờ
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Bài đã viết, hiện đúng như học viên sẽ thấy (cùng bảng màu đang chọn). Kèm
 * những điều giảng viên cần kiểm: mục dùng bản dự phòng, đoạn tài liệu không
 * thấy trong bài (cách Giữ nguyên lời).
 */
export function ResultView({
  result,
  look,
  onShowParas,
  hideCompare = false,
}: {
  result: LessonDraftResult;
  look: LessonLook | null;
  onShowParas: () => void;
  /** Bản giữ nguyên định dạng không có đoạn nào để đối chiếu. */
  hideCompare?: boolean;
}) {
  const multi = result.lessons.length > 1;
  return (
    <div className="mx-auto max-w-3xl space-y-5 px-3 py-5 sm:px-6">
      {result.fallbackSections.length > 0 && (
        <p className="banner-warning text-sm">
          AI chưa viết được {result.fallbackSections.length} mục ({result.fallbackSections.join(", ")}). Các mục này đang dùng
          nguyên đoạn tài liệu; bạn có thể sửa tay sau khi áp dụng hoặc bấm Tạo lại.
        </p>
      )}
      {result.writing === "keep" &&
        !hideCompare &&
        (result.missingParas.length > 0 ? (
          <div className="banner-warning flex flex-wrap items-center gap-2 text-sm">
            <span className="flex-1">
              Đã đối chiếu với tài liệu: {result.missingParas.length} đoạn không thấy đủ trong bài (đoạn{" "}
              {result.missingParas.map((n) => n + 1).join(", ")}). Hãy kiểm lại trước khi áp dụng.
            </span>
            <button type="button" className="font-semibold underline" onClick={onShowParas}>
              Xem tài liệu gốc
            </button>
          </div>
        ) : (
          <p className="banner-success text-sm">Đã đối chiếu với tài liệu: mọi đoạn đã gán vào mục đều có trong bài.</p>
        ))}
      {result.lessons.map((l, i) => (
        <div key={i}>
          {multi && (
            <p className="text-caption mb-2 text-center text-faint">
              Bài {i + 1} · {i === 0 ? "vào bài học đang mở" : "bài học mới ngay sau, ẩn với học viên cho tới khi bạn bật hiện"}
            </p>
          )}
          <LessonRichText html={l.html} look={look} className="mx-auto max-w-3xl shadow-sm" />
        </div>
      ))}
    </div>
  );
}
