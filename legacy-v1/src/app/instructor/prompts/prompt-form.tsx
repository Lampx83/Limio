"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PromptForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [template, setTemplate] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/instructor/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, template, is_public: isPublic }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Lưu thất bại");
        return;
      }
      setOpen(false);
      setTitle("");
      setDescription("");
      setTemplate("");
      setIsPublic(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        + Thêm mẫu prompt
      </button>
    );

  return (
    <form onSubmit={submit} className="card p-4 space-y-3">
      <h3 className="font-semibold">Mẫu prompt mới</h3>
      <input
        className="input"
        placeholder="Tên mẫu (vd: Feedback bài luận - tích cực)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        minLength={3}
      />
      <input
        className="input"
        placeholder="Mô tả ngắn"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <textarea
        className="input min-h-[160px] font-mono text-sm"
        placeholder="Nội dung prompt. Có thể dùng biến: {student_answer}, {rubric}, {learning_style}..."
        value={template}
        onChange={(e) => setTemplate(e.target.value)}
        required
        minLength={20}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          className="w-4 h-4"
        />
        Chia sẻ với giảng viên cùng cơ sở
      </label>
      {error && <div className="text-sm text-rose-600">{error}</div>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn-secondary"
        >
          Huỷ
        </button>
        <button disabled={submitting} className="btn-primary">
          {submitting ? "Đang lưu..." : "Lưu mẫu"}
        </button>
      </div>
    </form>
  );
}
