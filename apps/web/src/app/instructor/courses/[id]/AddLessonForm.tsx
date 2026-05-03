"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AddLessonForm({
  moduleId,
  nextOrderIndex,
}: {
  moduleId: string;
  nextOrderIndex: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-dashed border-token py-2 text-sm font-medium text-muted transition-colors hover:border-brand-300 hover:bg-brand-soft hover:text-brand-700"
      >
        + Thêm lesson
      </button>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch(`/api/modules/${moduleId}/lessons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: description.trim() || undefined,
        orderIndex: nextOrderIndex,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setTitle("");
      setDescription("");
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-2 rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-3"
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        maxLength={200}
        placeholder="Tên lesson"
        className="input"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        maxLength={2_000}
        placeholder="Mô tả ngắn (optional)"
        className="textarea"
      />
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn-primary btn-sm">
          {busy ? "..." : "Tạo lesson"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn-secondary btn-sm"
        >
          Hủy
        </button>
      </div>
    </form>
  );
}
