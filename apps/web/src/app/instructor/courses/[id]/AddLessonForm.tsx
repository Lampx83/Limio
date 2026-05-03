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
        className="w-full rounded border border-dashed border-slate-300 py-2 text-sm text-slate-500 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
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
      className="space-y-2 rounded border border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40"
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        maxLength={200}
        placeholder="Tên lesson"
        className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm dark:bg-slate-900 dark:border-slate-700"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        maxLength={2_000}
        placeholder="Mô tả ngắn (optional)"
        className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm dark:bg-slate-900 dark:border-slate-700"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
        >
          {busy ? "..." : "Tạo lesson"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700"
        >
          Hủy
        </button>
      </div>
    </form>
  );
}
