"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

interface Choice {
  id: string;
  title: string;
  status: "draft" | "published";
  sectionCount: number;
  totalMinutes: number;
}

/**
 * Ô chọn đề cho khối "Đề thi" (docs/tieu-chi/bai-hoc-gan-de-thi.md): liệt kê đề thi thử của khoá chứa bài (tên, số phần, số phút, Nháp/Đã xuất
 * bản). Khoá chưa có đề thì báo kèm link tạo đề.
 */
export default function ExamRefPicker({ lessonId, value, onChange }: { lessonId: string; value: string | null; onChange: (examId: string) => void }) {
  const [state, setState] = useState<{ courseId: string; choices: Choice[] } | "loading" | "error">("loading");
  useEffect(() => {
    let alive = true;
    fetch(apiUrl(`/api/lessons/${lessonId}/exam-ref-choices`))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => alive && setState(d))
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
    };
  }, [lessonId]);

  if (state === "loading") return <p className="text-meta text-muted">Đang tải danh sách đề…</p>;
  if (state === "error") return <p role="alert" className="text-meta text-danger-600">Không tải được danh sách đề. Thử lại sau.</p>;
  if (state.choices.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-token p-3 text-sm">
        <p className="font-medium">Khoá chưa có đề thi thử</p>
        <p className="text-meta mt-0.5 text-muted">Tạo một đề thi thử ở trang đề thi của khoá, rồi quay lại gắn vào bài.</p>
        <Link href={`/instructor/courses/${state.courseId}/exams/new`} className="link mt-1 inline-block text-sm font-medium">
          Tạo đề thi thử →
        </Link>
      </div>
    );
  }
  const picked = state.choices.find((c) => c.id === value);
  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label="Chọn đề thi" className="space-y-1.5">
        {state.choices.map((c) => (
          <label
            key={c.id}
            className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 text-sm ${value === c.id ? "border-brand-400 bg-brand-soft" : "border-token hover:bg-[rgb(var(--surface-muted))]"}`}
          >
            <input type="radio" name="exam-ref" className="mt-1" checked={value === c.id} onChange={() => onChange(c.id)} />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{c.title}</span>
              <span className="text-meta text-muted">
                {c.sectionCount} phần · {c.totalMinutes} phút
              </span>
            </span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${c.status === "published" ? "bg-success-50 text-success-700" : "bg-amber-100 text-amber-800"}`}>
              {c.status === "published" ? "Đã xuất bản" : "Nháp"}
            </span>
          </label>
        ))}
      </div>
      {picked?.status === "draft" && <p className="text-meta text-amber-800">Đề đang nháp: học viên chỉ thấy khối này sau khi đề được xuất bản.</p>}
    </div>
  );
}
