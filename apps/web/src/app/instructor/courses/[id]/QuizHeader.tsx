"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
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

/** Compact button group (eye / edit / delete) for the quiz section header. */
export function QuizActionButtons({
  quiz,
  onEdit,
}: {
  quiz: Quiz;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [isHidden, setIsHidden] = useState(quiz.isHidden);

  async function toggleHidden(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !isHidden;
    setIsHidden(next);
    await fetch(apiUrl(`/api/quizzes/${quiz.id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isHidden: next }),
    });
    router.refresh();
  }

  async function remove(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Xóa quiz "${quiz.title}"? Cascade questions, options, attempts.`)) return;
    setBusy(true);
    const res = await fetch(apiUrl(`/api/quizzes/${quiz.id}`), { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  function handleEdit(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onEdit();
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-token bg-surface-2/50 p-0.5">
      <button
        type="button"
        onClick={toggleHidden}
        className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
          isHidden
            ? "bg-danger-50 text-danger-600 hover:bg-danger-100"
            : "text-faint hover:bg-brand-soft hover:text-brand-600"
        }`}
        title={isHidden ? "Quiz đang ẩn — bấm để hiện cho học viên" : "Quiz đang hiện — bấm để ẩn khỏi học viên"}
        aria-label={isHidden ? "Hiện quiz" : "Ẩn quiz"}
        aria-pressed={isHidden}
      >
        {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
      <button
        type="button"
        onClick={handleEdit}
        className="flex h-7 w-7 items-center justify-center rounded-md text-faint transition-colors hover:bg-brand-soft hover:text-brand-600"
        title="Sửa quiz (tiêu đề, difficulty, pass %)"
        aria-label="Sửa quiz"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        title="Xoá quiz (cascade câu hỏi & lượt làm bài)"
        aria-label="Xoá quiz"
        className="flex h-7 w-7 items-center justify-center rounded-md text-faint transition-colors hover:bg-danger-50 hover:text-danger-600 disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Inline edit form for the quiz body. */
export function QuizEditForm({
  quiz,
  onClose,
}: {
  quiz: Quiz;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(quiz.title);
  const [difficulty, setDifficulty] = useState(quiz.difficulty ?? 1);
  const [passThresholdPct, setPassThresholdPct] = useState(quiz.passThresholdPct);
  const [requireConfidence, setRequireConfidence] = useState(quiz.requireConfidence);

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
      onClose();
      router.refresh();
    }
  }

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
          onClick={onClose}
          className="btn-secondary btn-sm"
        >
          Hủy
        </button>
      </div>
    </form>
  );
}
