"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

interface Quiz {
  id: string;
  title: string;
  difficulty: number | null;
  passThresholdPct: number;
  requireConfidence: boolean;
  timeLimitSec: number | null;
  maxAttempts: number | null;
  isHidden: boolean;
}

export default function QuizHeader({ quiz }: { quiz: Quiz }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(quiz.title);
  const [difficulty, setDifficulty] = useState(quiz.difficulty ?? 1);
  const [passThresholdPct, setPassThresholdPct] = useState(quiz.passThresholdPct);
  const [requireConfidence, setRequireConfidence] = useState(quiz.requireConfidence);
  const [isHidden, setIsHidden] = useState(quiz.isHidden);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch(apiUrl(`/api/quizzes/${quiz.id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, difficulty, passThresholdPct, requireConfidence }),
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
    await fetch(apiUrl(`/api/quizzes/${quiz.id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isHidden: next }),
    });
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Xóa quiz "${quiz.title}"? Cascade questions, options, attempts.`)) return;
    setBusy(true);
    const res = await fetch(apiUrl(`/api/quizzes/${quiz.id}`), { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  if (editing) {
    return (
      <form onSubmit={save} className="space-y-3 rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="input"
        />
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-xs text-muted">Difficulty</span>
            <input
              type="number"
              min={1}
              max={5}
              value={difficulty}
              onChange={(e) => setDifficulty(Number(e.target.value))}
              className="input w-16"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-xs text-muted">Pass %</span>
            <input
              type="number"
              min={0}
              max={100}
              value={passThresholdPct}
              onChange={(e) => setPassThresholdPct(Number(e.target.value))}
              className="input w-16"
            />
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={requireConfidence}
              onChange={(e) => setRequireConfidence(e.target.checked)}
              className="h-4 w-4 rounded border-token accent-brand-600"
            />
            <span>Yêu cầu đánh giá độ tự tin</span>
          </label>
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
    );
  }

  return (
    <div className="flex items-center justify-end gap-3">
      <label className="flex items-center gap-2 cursor-pointer" title={isHidden ? "Quiz bị ẩn khỏi học viên" : "Quiz hiển thị với học viên"}>
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
        className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition-colors hover:bg-brand-soft hover:text-brand-600"
        title="Sửa quiz"
        aria-label="Sửa"
      >
        ✎
      </button>
      <button
        onClick={remove}
        disabled={busy}
        title="Xóa quiz"
        aria-label="Xóa"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition-colors hover:bg-danger-50 hover:text-danger-600 disabled:opacity-50"
      >
        🗑️
      </button>
    </div>
  );
}
