"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";

/**
 * Form tạo nhanh: tên bài + thời lượng (+ chọn khoá khi GV dạy nhiều khoá).
 *
 * Thời lượng hiện ngay trên form chứ không giấu trong "nâng cao":
 * `Exam.durationMin` vốn bắt buộc và không có khái niệm "không giới hạn", nên
 * giấu đi không phải là đơn giản hoá — mà là chọn hộ giáo viên một con số họ
 * không nhìn thấy.
 *
 * Không hỏi giờ mở/đóng: ca thi quyết định, và ca sinh ra lúc bấm "Phát link"
 * chạy chế độ thủ công — mở ngay, đóng khi GV bấm.
 */
export default function QuickExamForm({
  purpose,
  courses,
  initialCourseId,
}: {
  purpose: "assessment" | "field_test";
  courses: Array<{ id: string; title: string }>;
  initialCourseId: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [durationMin, setDurationMin] = useState(15);
  const [courseId, setCourseId] = useState(initialCourseId);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(apiUrl(`/api/courses/${courseId}/exams`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), durationMin, purpose }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        examId?: string;
        error?: string;
      };
      if (!res.ok || !data.examId) {
        setErr(data.error ?? `HTTP ${res.status}`);
        return;
      }
      // Bàn giao ngay sang tab Nội dung — bước tiếp theo luôn là thêm câu hỏi.
      router.push(
        `/instructor/courses/${courseId}/exams/${data.examId}?tab=content`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      {courses.length > 1 && (
        <label className="block">
          <span className="block text-sm font-medium">Khoá học</span>
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="mt-1 w-full rounded border border-default bg-white px-3 py-2 text-sm"
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block">
        <span className="block text-sm font-medium">Tên bài</span>
        <input
          type="text"
          required
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            purpose === "field_test"
              ? "Ví dụ: Thử nghiệm câu hỏi HSK1 đợt 1"
              : "Ví dụ: Kiểm tra đầu giờ buổi 3"
          }
          className="mt-1 w-full rounded border border-default bg-white px-3 py-2 text-sm"
        />
      </label>

      <label className="block">
        <span className="block text-sm font-medium">Thời lượng làm bài (phút)</span>
        <input
          type="number"
          required
          min={1}
          max={1440}
          value={durationMin}
          onChange={(e) => setDurationMin(Number(e.target.value))}
          className="mt-1 w-32 rounded border border-default bg-white px-3 py-2 text-sm"
        />
        <span className="mt-1 block text-caption text-faint">
          Đếm từ lúc học sinh bấm bắt đầu. Bài mở ngay khi bạn phát link, và
          đóng khi bạn bấm.
        </span>
      </label>

      {err && (
        <div className="banner-danger px-3 py-2 text-sm">Không tạo được: {err}</div>
      )}

      <button
        type="submit"
        disabled={busy || !title.trim()}
        className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {busy ? "Đang tạo…" : "Tạo rồi thêm câu hỏi →"}
      </button>
    </form>
  );
}
