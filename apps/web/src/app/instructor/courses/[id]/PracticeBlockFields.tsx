"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

interface ExamOption {
  id: string;
  title: string;
  allowPractice: boolean;
}

/**
 * Ô chọn đề của khối "Bài luyện" (LANG đợt 3b). Chỉ liệt kê đề thi thử đã xuất bản của chính khoá; đề đã tắt
 * "Cho luyện đề" vẫn chọn được nhưng được ghi chú rõ để giảng viên biết học viên chưa làm được.
 */
export default function PracticeBlockFields({
  lessonId,
  examId,
  title,
  onExamId,
  onTitle,
}: {
  lessonId: string;
  examId: string;
  title: string;
  onExamId: (v: string) => void;
  onTitle: (v: string) => void;
}) {
  const [exams, setExams] = useState<ExamOption[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(apiUrl(`/api/lessons/${lessonId}/practice-exams`))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { exams: ExamOption[] }) => alive && setExams(d.exams))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [lessonId]);

  const selected = exams?.find((e) => e.id === examId);
  return (
    <div className="space-y-2">
      <input
        value={title}
        onChange={(e) => onTitle(e.target.value)}
        maxLength={200}
        placeholder="Tiêu đề bài luyện (không bắt buộc, trống thì dùng tên đề)"
        className="input"
      />
      <label className="block text-sm">
        <span className="text-xs text-muted">Đề thi thử</span>
        <select value={examId} onChange={(e) => onExamId(e.target.value)} className="input" required disabled={!exams}>
          <option value="">{exams ? "Chọn một đề thi thử" : failed ? "Không tải được danh sách đề" : "Đang tải…"}</option>
          {exams?.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
              {e.allowPractice ? "" : " (đang tắt luyện đề)"}
            </option>
          ))}
        </select>
      </label>
      {exams && exams.length === 0 && (
        <p className="text-xs text-muted">
          Khoá chưa có đề thi thử nào đã xuất bản. Tạo đề ở mục Đề thi (&quot;Tạo đề thi thử từ khung&quot;) rồi xuất bản trước.
        </p>
      )}
      {selected && !selected.allowPractice && (
        <p className="text-xs text-amber-700">Đề này đang tắt &quot;Cho luyện đề&quot;: học viên sẽ thấy thông báo &quot;Bài luyện đang tắt&quot; cho tới khi bật lại.</p>
      )}
    </div>
  );
}
