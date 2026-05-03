"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AddModuleForm({
  courseId,
  nextOrderIndex,
}: {
  courseId: string;
  nextOrderIndex: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded border-2 border-dashed border-slate-300 py-3 text-sm text-slate-500 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
      >
        + Thêm module
      </button>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/courses/${courseId}/modules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, orderIndex: nextOrderIndex }),
    });
    setBusy(false);
    if (res.ok) {
      setTitle("");
      setOpen(false);
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "create_failed");
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded border border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40"
    >
      <div className="flex items-end gap-2">
        <label className="flex-1 block">
          <span className="text-xs font-medium uppercase text-slate-500">Tên module</span>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm dark:bg-slate-900 dark:border-slate-700"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
        >
          {busy ? "..." : "Tạo"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700"
        >
          Hủy
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">Lỗi: {error}</p>}
    </form>
  );
}
