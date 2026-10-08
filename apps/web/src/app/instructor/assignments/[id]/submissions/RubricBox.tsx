"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { lmsErrorMessage } from "@/lib/lmsErrors";
import { toast } from "@/lib/toast";

/**
 * Rubric chấm điểm của cả bài tập — nhập ngay ở trang chấm bài, cạnh nút
 * "✨ Gợi ý điểm bằng AI" trên từng bài nộp (AI đọc rubric này khi gợi ý điểm).
 * Trước đây rubric nhập ở form tạo/sửa bài tập, nay chuyển về đúng chỗ dùng.
 */
export default function RubricBox({
  assignmentId,
  initialRubric,
  compact = false,
}: {
  assignmentId: string;
  initialRubric: string | null;
  /** Trong modal chấm bài: bỏ khung card + lề trên, vì đã nằm trong khối thu gọn. */
  compact?: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialRubric ?? "");
  const [text, setText] = useState(initialRubric ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = text.trim() !== saved.trim();

  // Rubric có thể vừa được lưu từ ô còn lại (trang vs modal) → router.refresh đổi prop → đồng bộ lại.
  useEffect(() => {
    setSaved(initialRubric ?? "");
    setText(initialRubric ?? "");
  }, [initialRubric]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/assignments/${assignmentId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rubricText: text.trim() || null }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(lmsErrorMessage((d as { error?: string }).error, res.status));
        return;
      }
      setSaved(text.trim());
      toast.success("Đã lưu rubric");
      router.refresh();
    } catch {
      setError(lmsErrorMessage("network_error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={compact ? "space-y-2" : "card mt-6 space-y-2"}>
      <label htmlFor={`rubric-${assignmentId}`} className="text-sm font-semibold">
        Rubric chấm điểm{" "}
        <span className="text-xs font-normal text-faint">(không bắt buộc)</span>
      </label>
      <p className="text-xs text-faint">
        Tiêu chí và thang điểm bạn dùng để chấm. Khi bấm &ldquo;✨ Gợi ý điểm bằng
        AI&rdquo; ở từng bài nộp, AI sẽ đọc rubric này cùng đề bài và bài làm.
      </p>
      <textarea
        id={`rubric-${assignmentId}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        maxLength={5000}
        placeholder={"Ví dụ: 3đ nêu đúng khái niệm. 4đ có ví dụ. 3đ trình bày rõ ràng."}
        className="textarea"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy || !dirty}
          className="btn-primary btn-sm"
        >
          {busy ? "Đang lưu…" : "Lưu rubric"}
        </button>
        {error && (
          <span role="alert" className="text-xs text-danger-600">
            {error}
          </span>
        )}
      </div>
    </section>
  );
}
