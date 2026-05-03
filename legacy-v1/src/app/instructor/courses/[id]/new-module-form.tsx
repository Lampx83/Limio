"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewModuleForm({
  courseId,
  nextOrder,
}: {
  courseId: number;
  nextOrder: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/instructor/courses/${courseId}/modules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, order_idx: nextOrder }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Tạo module thất bại");
        return;
      }
      setOpen(false);
      setTitle("");
      setDescription("");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="btn-secondary">
        + Thêm module
      </button>
    );

  return (
    <form onSubmit={submit} className="card p-4 space-y-3">
      <h3 className="font-semibold">Module mới (Tuần {nextOrder})</h3>
      <input
        className="input"
        placeholder="Tên module"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        minLength={3}
      />
      <textarea
        className="input min-h-[60px]"
        placeholder="Mô tả ngắn"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
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
          {submitting ? "Đang lưu..." : "Tạo module"}
        </button>
      </div>
    </form>
  );
}
