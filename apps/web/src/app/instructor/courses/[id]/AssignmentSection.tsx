"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface Assignment {
  id: string;
  title: string;
  description: string;
  dueAt: Date | null;
  maxScore: number;
}

export default function AssignmentSection({
  assignment,
}: {
  assignment: Assignment;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(assignment.title);
  const [description, setDescription] = useState(assignment.description);
  const [dueAt, setDueAt] = useState(
    assignment.dueAt
      ? new Date(assignment.dueAt).toISOString().slice(0, 16)
      : "",
  );
  const [maxScore, setMaxScore] = useState(String(assignment.maxScore));
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload: Record<string, unknown> = {
      title,
      description,
      maxScore: Number(maxScore) || 100,
    };
    if (dueAt) payload.dueAt = new Date(dueAt).toISOString();
    const res = await fetch(`/api/assignments/${assignment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) {
      setEditing(false);
      router.refresh();
    }
  }

  async function remove() {
    if (!confirm("Xóa assignment này?")) return;
    setBusy(true);
    const res = await fetch(`/api/assignments/${assignment.id}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <div className="rounded border border-slate-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
      {!editing ? (
        <>
          <div className="flex items-baseline justify-between">
            <p className="font-medium">📋 {assignment.title}</p>
            <span className="text-xs text-slate-500">
              max {assignment.maxScore}đ
              {assignment.dueAt && (
                <>
                  {" · "}đến{" "}
                  {new Date(assignment.dueAt).toLocaleString("vi-VN")}
                </>
              )}
            </span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700 dark:text-slate-300">
            {assignment.description}
          </p>
          <div className="mt-2 flex gap-2 text-xs">
            <Link
              href={`/instructor/assignments/${assignment.id}/submissions`}
              className="rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Xem bài nộp
            </Link>
            <button
              onClick={() => setEditing(true)}
              className="rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Sửa
            </button>
            <button
              onClick={remove}
              disabled={busy}
              className="rounded border border-red-300 px-2 py-0.5 text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
            >
              Xóa
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={save} className="space-y-2 text-xs">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={3}
            className="w-full rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
          />
          <div className="flex gap-2">
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="flex-1 rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
            />
            <input
              type="number"
              min={1}
              value={maxScore}
              onChange={(e) => setMaxScore(e.target.value)}
              className="w-20 rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded bg-slate-900 px-2 py-1 font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
            >
              Lưu
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded border border-slate-300 px-2 py-1 dark:border-slate-700"
            >
              Hủy
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
