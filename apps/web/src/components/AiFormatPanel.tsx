"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { LimeSliceIcon } from "@/components/BrandIcons";
import {
  LESSON_FORMAT_TEMPLATE_HINTS,
  LESSON_FORMAT_TEMPLATE_KEYS,
  LESSON_FORMAT_TEMPLATE_LABELS,
  type LessonFormatTemplateKey,
} from "@feedbackme/shared-types";
import SafeHtml from "@/components/SafeHtml";
import { apiUrl } from "@/lib/apiUrl";

function describeFormatError(status: number, code: string | undefined): string {
  if (code === "unauthorized") return "Phiên đăng nhập đã hết hạn — tải lại trang.";
  if (code === "forbidden") return "Bạn không có quyền sửa bài này.";
  if (code === "not_found") return "Không tìm thấy bài học (có thể đã bị xoá).";
  if (code === "empty_content" || status === 400) return "Nội dung đang trống — nhập nội dung trước.";
  if (code === "too_long") return "Nội dung quá dài (giới hạn 100.000 ký tự).";
  if (code === "openai_not_configured") return "Chưa cấu hình AI cho hệ thống — báo admin.";
  if (code === "global_token_cap" || code === "daily_token_cap")
    return "Hệ thống đang vượt hạn mức dùng AI hôm nay — thử lại sau.";
  if (code === "no_token_budget") return "Ví token AI của bạn đã hết cho tháng này.";
  if (code === "rate_limited") return "Bạn đang định dạng quá nhanh — thử lại sau ít phút.";
  if (code === "openai_error" || code === "json_parse_failed")
    return "AI xử lý thất bại — thử lại.";
  return "Định dạng thất bại. Thử lại sau.";
}

// Thẻ swatch cho từng theme — chấm màu đơn cho 3 theme đầu, 3 vạch màu cho
// "Sinh động" vì theme đó không có MỘT màu đại diện (mỗi mục ## đổi màu khác
// nhau), swatch phải gợi ý đúng điều đó chứ không được bịa ra 1 màu chủ đạo.
function ThemeSwatch({ k }: { k: LessonFormatTemplateKey }) {
  if (k === "vibrant") {
    return (
      <span className="flex shrink-0 gap-[2px]">
        <span className="h-3 w-1 rounded-sm" style={{ background: "rgb(59,130,246)" }} />
        <span className="h-3 w-1 rounded-sm" style={{ background: "rgb(139,92,246)" }} />
        <span className="h-3 w-1 rounded-sm" style={{ background: "rgb(13,148,136)" }} />
      </span>
    );
  }
  const color = k === "clean" ? "#B5D4F4" : k === "academic" ? "#CECBF6" : "#9FE1CB";
  return <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color }} />;
}

export default function AiFormatPanel({
  lessonId,
  html,
  onSaved,
  onClose,
}: {
  lessonId: string;
  html: string;
  /** Lưu HTML đã định dạng vào bài (tạo mới hoặc cập nhật, tuỳ form gọi component này) — CHỈ lưu, không tự đóng form. Ném lỗi để hiện banner, không chuyển sang trạng thái đã lưu. */
  onSaved: (formattedHtml: string) => Promise<void>;
  /** GV bấm "Đóng form" sau khi thấy đã lưu thành công — cha tự đóng/reset UI của nó. */
  onClose: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [template, setTemplate] = useState<LessonFormatTemplateKey>("clean");
  const [busyFormat, setBusyFormat] = useState(false);
  const [busySave, setBusySave] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formatted, setFormatted] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onFormat() {
    if (!html.trim()) {
      setError(describeFormatError(400, "empty_content"));
      return;
    }
    setBusyFormat(true);
    setError(null);
    setFormatted(null);
    try {
      const res = await fetch(apiUrl(`/api/lessons/${lessonId}/format-ai`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, template }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(describeFormatError(res.status, (d as { error?: string }).error));
        return;
      }
      setFormatted((d as { html: string }).html);
    } catch {
      setError("Mất kết nối tới máy chủ. Kiểm tra mạng rồi thử lại.");
    } finally {
      setBusyFormat(false);
    }
  }

  async function onApply() {
    if (!formatted) return;
    setBusySave(true);
    setError(null);
    try {
      await onSaved(formatted);
      setSaved(true);
    } catch (e) {
      setError(`Lưu thất bại: ${(e as Error).message || "thử lại sau"}`);
    } finally {
      setBusySave(false);
    }
  }

  if (saved) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-lg border border-token bg-success-50 p-4 text-center dark:bg-success-950/40">
        <span className="text-2xl" aria-hidden>
          ✅
        </span>
        <p className="text-sm font-medium text-success-700">Đã lưu bài học</p>
        <button type="button" onClick={onClose} className="btn-secondary btn-sm">
          Đóng form
        </button>
      </div>
    );
  }

  if (!revealed) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 p-4 text-center">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-violet-200 text-violet-900">
          <Sparkles className="h-7 w-7" aria-hidden />
        </span>
        <p className="max-w-xs text-base font-medium text-default">
          Dán xong nội dung bên cạnh thì bấm tiếp tục để chọn giao diện và định
          dạng bằng AI.
        </p>
        <button
          type="button"
          onClick={() => setRevealed(true)}
          disabled={!html.trim()}
          title={html.trim() ? undefined : "Nhập nội dung trước"}
          className="btn btn-sm bg-violet-200 text-violet-900 hover:bg-violet-300 active:scale-[0.98]"
        >
          Tiếp tục →
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-token bg-[rgb(var(--surface-muted))/0.4] p-3">
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-muted">Chọn phong cách</label>
        <div className="grid grid-cols-4 gap-1.5">
          {LESSON_FORMAT_TEMPLATE_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTemplate(k)}
              disabled={busyFormat || busySave}
              className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-xs font-medium transition-colors ${
                template === k
                  ? "border-brand-400 bg-brand-soft"
                  : "border-token bg-[rgb(var(--surface))] hover:border-brand-200"
              }`}
            >
              <ThemeSwatch k={k} />
              {LESSON_FORMAT_TEMPLATE_LABELS[k]}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-sm text-muted">{LESSON_FORMAT_TEMPLATE_HINTS[template]}</p>
      </div>

      <div>
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onFormat}
            disabled={busyFormat || busySave || !html.trim()}
            className="btn btn-sm inline-flex items-center gap-1.5 bg-violet-200 text-violet-900 hover:bg-violet-300 active:scale-[0.98]"
          >
            {busyFormat ? (
              <>
                <LimeSliceIcon className="h-4 w-4 animate-spin" />
                Đang định dạng…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" aria-hidden />
                Định dạng bằng AI
              </>
            )}
          </button>
        </div>
        <p className="mt-1.5 text-sm text-muted">
          AI sắp xếp lại đúng nội dung đang có theo giao diện đã chọn — không
          thêm bớt ý. &ldquo;Áp dụng&rdquo; sẽ lưu thẳng vào bài học.
        </p>
      </div>

      {error && (
        <p role="alert" className="banner-danger text-sm">
          {error}
        </p>
      )}

      <div>
        {busyFormat ? (
          <div className="space-y-2 rounded-md border border-dashed border-token p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-brand-700">
              <LimeSliceIcon className="h-3.5 w-3.5 animate-spin" />
              AI đang định dạng — thường mất vài giây…
            </div>
            <div className="h-3 w-4/5 animate-pulse rounded bg-[rgb(var(--surface-muted))]" />
            <div className="h-3 w-full animate-pulse rounded bg-[rgb(var(--surface-muted))]" />
            <div className="h-3 w-3/5 animate-pulse rounded bg-[rgb(var(--surface-muted))]" />
          </div>
        ) : formatted ? (
          <div className="max-h-72 overflow-y-auto rounded-md border border-token bg-[rgb(var(--surface))] p-3">
            <SafeHtml html={formatted} className="prose prose-sm max-w-none dark:prose-invert" />
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-token p-3 text-xs text-faint">
            Kết quả AI sẽ hiện ở đây.
          </p>
        )}
      </div>

      {formatted && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFormatted(null)}
            disabled={busySave}
            className="btn-secondary btn-sm"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={onApply}
            disabled={busySave}
            className="btn-primary btn-sm"
          >
            {busySave ? "Đang lưu…" : "Áp dụng và lưu"}
          </button>
        </div>
      )}
    </div>
  );
}
