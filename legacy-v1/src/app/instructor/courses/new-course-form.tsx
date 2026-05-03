"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewCourseForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/instructor/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, title, description }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Tạo khoá học thất bại");
        return;
      }
      setOpen(false);
      setCode("");
      setTitle("");
      setDescription("");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        + Khởi tạo khoá học mới
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="card p-4 sm:p-5 space-y-3">
      <h3 className="font-semibold">Khoá học mới</h3>
      <div>
        <label className="label">Mã khoá học</label>
        <input
          className="input font-mono"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          required
          maxLength={20}
          placeholder="VD: EDT201"
        />
      </div>
      <div>
        <label className="label">Tên khoá</label>
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
        />
      </div>
      <div>
        <label className="label">Mô tả ngắn (tuỳ chọn)</label>
        <textarea
          className="input min-h-[80px]"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      {error && <div className="text-sm text-rose-600">{error}</div>}
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn-secondary"
        >
          Huỷ
        </button>
        <button disabled={submitting} className="btn-primary">
          {submitting ? "Đang lưu..." : "Tạo khoá học"}
        </button>
      </div>
    </form>
  );
}
