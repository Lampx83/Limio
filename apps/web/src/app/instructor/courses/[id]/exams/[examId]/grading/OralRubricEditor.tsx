"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";

/**
 * A6.4 (UI) — rubric chấm điểm GV tự gõ/sửa, dùng khi AI đề xuất điểm sau
 * buổi thi (xem generateOralExamEvaluation). Sửa được bất cứ lúc nào kể cả
 * đề đã publish/có lượt thi — rubric chỉ ảnh hưởng cách CHẤM sau này, không
 * ảnh hưởng câu hỏi SV nhận lúc thi.
 */
export default function OralRubricEditor({
  examId,
  initialRubric,
}: {
  examId: string;
  initialRubric: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rubric, setRubric] = useState(initialRubric);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(apiUrl(`/api/exams/${examId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oralRubricText: rubric || undefined }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(typeof d?.error === "string" ? d.error : "save_failed");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <div className="mb-4 flex items-center justify-between rounded border border-default bg-white p-3">
        <p className="min-w-0 flex-1 truncate text-sm">
          <span className="font-medium">Rubric chấm điểm: </span>
          {initialRubric ? (
            <span className="text-faint">{initialRubric}</span>
          ) : (
            <span className="text-faint">Chưa có — AI sẽ tự do đánh giá theo hội thoại.</span>
          )}
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="ml-3 shrink-0 rounded border border-default px-3 py-1 text-xs hover:bg-slate-50"
        >
          {initialRubric ? "Sửa rubric" : "Nhập rubric"}
        </button>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded border border-default bg-white p-4">
      <label className="block text-sm font-medium" htmlFor="oral-rubric">
        Rubric chấm điểm (tuỳ chọn)
      </label>
      <p className="mt-0.5 text-caption text-faint">
        Đưa vào lời nhắc khi bấm "Chấm bằng AI" cho từng lượt thi. Sửa xong có
        thể bấm "Chấm lại bằng AI" ở từng lượt để lấy đề xuất mới theo rubric
        này — không tự đổi điểm đã chốt trước đó.
      </p>
      <textarea
        id="oral-rubric"
        rows={5}
        value={rubric}
        onChange={(e) => setRubric(e.target.value)}
        placeholder={'Vd: "3đ nêu đúng khái niệm. 4đ cho ví dụ đúng. 3đ phân tích được ưu/nhược điểm."'}
        className="mt-1 w-full rounded border border-default px-3 py-2 text-sm"
      />
      {error && <p className="mt-1 text-xs text-red-700">Lỗi: {error}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setRubric(initialRubric);
            setOpen(false);
          }}
          className="rounded border border-default px-3 py-1.5 text-sm"
        >
          Huỷ
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded bg-brand-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Đang lưu…" : "Lưu rubric"}
        </button>
      </div>
    </div>
  );
}
