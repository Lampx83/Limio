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
  isHidden: boolean;
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
  const [isHidden, setIsHidden] = useState(assignment.isHidden);
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

  async function toggleHidden() {
    const next = !isHidden;
    setIsHidden(next);
    await fetch(`/api/assignments/${assignment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isHidden: next }),
    });
    router.refresh();
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
    <div className={`group/as rounded-xl border-2 p-4 transition-colors ${
      isHidden
        ? 'border-danger-200 bg-danger-50/50'
        : 'border-token bg-[rgb(var(--surface))]'
    }`}>
      {!editing ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-base font-semibold">{assignment.title}</p>
                {isHidden && <span className="chip-danger text-xs">👁️ Ẩn</span>}
              </div>
              {assignment.description && (
                <p className="mt-2 text-sm text-muted">{assignment.description}</p>
              )}
            </div>
            <span className="shrink-0 text-right text-sm text-muted">
              <div className="font-semibold text-base">{assignment.maxScore}đ</div>
              {assignment.dueAt && (
                <div className="text-xs text-faint mt-1">
                  {new Date(assignment.dueAt).toLocaleString("vi-VN")}
                </div>
              )}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              href={`/instructor/assignments/${assignment.id}/submissions`}
              className="btn-secondary btn-sm"
            >
              Xem bài nộp
            </Link>
            <label className="flex items-center gap-2 cursor-pointer" title={isHidden ? "Assignment bị ẩn khỏi học viên" : "Assignment hiển thị với học viên"}>
              <input
                type="checkbox"
                checked={isHidden}
                onChange={toggleHidden}
                className="w-5 h-5 rounded border-token cursor-pointer accent-danger-600"
              />
              <span className="text-xs font-medium text-muted">Ẩn</span>
            </label>
            <button
              onClick={() => setEditing(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-faint opacity-0 transition-all hover:bg-brand-soft hover:text-brand-600 group-hover/as:opacity-100"
              title="Sửa assignment"
              aria-label="Sửa"
            >
              ✎
            </button>
            <button
              onClick={remove}
              disabled={busy}
              title="Xóa assignment"
              aria-label="Xóa"
              className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-faint opacity-0 transition-all hover:bg-danger-50 hover:text-danger-600 group-hover/as:opacity-100 disabled:opacity-50"
            >
              🗑️
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={save} className="space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="input"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={3}
            className="textarea"
          />
          <div className="flex flex-wrap gap-2">
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="input flex-1"
            />
            <input
              type="number"
              min={1}
              value={maxScore}
              onChange={(e) => setMaxScore(e.target.value)}
              className="input w-24"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="btn-primary btn-sm">
              Lưu
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="btn-secondary btn-sm"
            >
              Hủy
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
