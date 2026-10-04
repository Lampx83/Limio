"use client";

import { useState } from "react";
import { Languages } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";

// Nhãn khớp LANGUAGE_TEMPLATES ở core-lms (không import trực tiếp để client bundle không kéo mã máy chủ).
const TEMPLATES = [
  { id: "zh", label: "Tiếng Trung", hint: "Sơ cấp · Pinyin · đề thi thử kiểu HSK" },
  { id: "en", label: "Tiếng Anh", hint: "Sơ cấp · IPA · đề thi thử kiểu IELTS" },
] as const;

const ERRORS: Record<string, string> = {
  forbidden: "Tài khoản của bạn chưa được cấp quyền giảng viên nên chưa tạo được khoá học.",
};

/**
 * LANG G8 — lối tắt tạo khoá mẫu ngoại ngữ ở trang tạo khoá. Bản nháp dựng sẵn bốn kỹ năng, rubric
 * Viết/Nói và một đề thi thử; giảng viên tự tải audio và chỉnh nội dung rồi mới xuất bản.
 */
export default function LanguageTemplatePicker() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function create(template: string) {
    setError(null);
    setBusy(template);
    try {
      const res = await fetch(apiUrl("/api/courses/language-template"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template }),
      });
      if (res.status === 401) {
        window.location.href = "/signin?callbackUrl=/instructor/courses/new";
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { courseId?: string; error?: string };
      if (res.ok && data.courseId) {
        window.location.href = `/instructor/courses/${data.courseId}?tab=content`;
        return;
      }
      setError(ERRORS[data.error ?? ""] ?? "Không tạo được khoá mẫu. Vui lòng thử lại.");
    } catch {
      setError("Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.");
    }
    setBusy(null);
  }

  return (
    <section aria-labelledby="lang-template-title" className="mt-5 card space-y-3">
      <header>
        <h2 id="lang-template-title" className="flex items-center gap-2 text-base font-semibold">
          <Languages size={18} aria-hidden /> Bắt đầu từ khoá mẫu ngoại ngữ
        </h2>
        <p className="mt-1 text-sm text-muted">
          Khoá nháp dựng sẵn bốn kỹ năng Nghe · Nói · Đọc · Viết, rubric chấm Viết/Nói và một đề thi thử.
          Nội dung tự soạn ở trình độ sơ cấp — bạn chỉnh lại và tải audio của mình rồi mới xuất bản.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={busy !== null}
            onClick={() => create(t.id)}
            className="rounded-xl border border-token bg-[rgb(var(--surface))] p-3 text-left transition-colors hover:bg-brand-soft disabled:opacity-60"
          >
            <span className="block font-medium">{busy === t.id ? "Đang tạo…" : t.label}</span>
            <span className="mt-0.5 block text-xs text-muted">{t.hint}</span>
          </button>
        ))}
      </div>
      {error && (
        <div role="alert" className="banner-danger text-sm">
          {error}
        </div>
      )}
    </section>
  );
}
