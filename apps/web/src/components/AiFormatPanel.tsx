"use client";

import { useState } from "react";
import {
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

export default function AiFormatPanel({
  lessonId,
  html,
  onApply,
}: {
  lessonId: string;
  html: string;
  onApply: (html: string) => void;
}) {
  const [template, setTemplate] = useState<LessonFormatTemplateKey>("clean");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formatted, setFormatted] = useState<string | null>(null);

  async function onFormat() {
    if (!html.trim()) {
      setError(describeFormatError(400, "empty_content"));
      return;
    }
    setBusy(true);
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
      setBusy(false);
    }
  }

  function apply() {
    if (!formatted) return;
    onApply(formatted);
    setFormatted(null);
  }

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-token bg-[rgb(var(--surface-muted))/0.4] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-faint">
          Định dạng bằng AI
        </label>
        <select
          value={template}
          onChange={(e) => setTemplate(e.target.value as LessonFormatTemplateKey)}
          disabled={busy}
          className="select max-w-[160px]"
        >
          {LESSON_FORMAT_TEMPLATE_KEYS.map((k) => (
            <option key={k} value={k}>
              {LESSON_FORMAT_TEMPLATE_LABELS[k]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onFormat}
          disabled={busy || !html.trim()}
          className="btn-secondary btn-sm"
        >
          {busy ? "Đang định dạng…" : "Định dạng bằng AI"}
        </button>
      </div>
      <p className="text-[11px] text-faint">
        AI sắp xếp lại nội dung đang có trong ô theo mẫu đã chọn (mục tiêu, các
        mục, ghi chú, tổng kết) — không thêm bớt ý. Xem trước trước khi áp dụng.
      </p>

      {error && (
        <p role="alert" className="banner-danger text-sm">
          {error}
        </p>
      )}

      {formatted && (
        <div className="space-y-2">
          <div className="max-h-80 overflow-y-auto rounded-md border border-token bg-[rgb(var(--surface))] p-3">
            <SafeHtml html={formatted} className="prose prose-sm max-w-none dark:prose-invert" />
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={apply} className="btn-primary btn-sm">
              Áp dụng vào bài
            </button>
            <button
              type="button"
              onClick={() => setFormatted(null)}
              className="btn-secondary btn-sm"
            >
              Huỷ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
