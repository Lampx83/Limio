"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AddAssignmentForm({ lessonId }: { lessonId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [maxScore, setMaxScore] = useState("100");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle("");
    setDescription("");
    setDueAt("");
    setMaxScore("100");
    setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload: Record<string, unknown> = {
      title,
      description,
      maxScore: Number(maxScore) || 100,
    };
    if (dueAt) payload.dueAt = new Date(dueAt).toISOString();
    const res = await fetch(`/api/lessons/${lessonId}/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) {
      reset();
      setOpen(false);
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "create_failed");
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-slate-500 underline hover:text-slate-700 dark:hover:text-slate-300"
      >
        + Thêm assignment
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-2 rounded border border-slate-300 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-900/40"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        maxLength={200}
        placeholder="Tiêu đề assignment"
        className="w-full rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
        rows={4}
        placeholder="Mô tả nhiệm vụ..."
        className="w-full rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
      />
      <div className="flex gap-2">
        <label className="flex-1">
          <span className="text-slate-500">Hạn nộp (optional)</span>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
          />
        </label>
        <label className="w-24">
          <span className="text-slate-500">Điểm tối đa</span>
          <input
            type="number"
            min={1}
            max={1000}
            value={maxScore}
            onChange={(e) => setMaxScore(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
          />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-slate-900 px-2 py-1 font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
        >
          {busy ? "..." : "Tạo"}
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="rounded border border-slate-300 px-2 py-1 dark:border-slate-700"
        >
          Hủy
        </button>
        {error && <span className="text-red-600">Lỗi: {error}</span>}
      </div>
    </form>
  );
}
