"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";

interface Quiz {
  id: string;
  title: string;
  difficulty: number | null;
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
    if (!confirm(`Xoá quiz "${quiz.title}"? Cascade câu hỏi & options.`)) return;
    setBusy(true);
    let res = await fetch(apiUrl(`/api/quizzes/${quiz.id}`), { method: "DELETE" });
    if (res.status === 409) {
      const body = (await res.json().catch(() => null)) as
        | { error?: string; details?: { attemptCount?: number } }
        | null;
      if (body?.error === "quiz_has_attempts") {
        const n = body.details?.attemptCount ?? "một số";
        const ok = confirm(
          `Quiz này đã có ${n} lượt làm bài. Xoá sẽ mất toàn bộ lịch sử làm bài (QuizAttempt + AnswerResponse). Vẫn tiếp tục?`,
        );
        if (!ok) {
          setBusy(false);
          return;
        }
        res = await fetch(apiUrl(`/api/quizzes/${quiz.id}?force=true`), { method: "DELETE" });
      }
    }
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      alert(`Xoá thất bại: ${body?.error ?? res.statusText}`);
    }
  }

  function handleEdit(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onEdit();
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-lg p-0.5 opacity-70 transition-opacity group-hover:opacity-100 focus-within:opacity-100 max-lg:opacity-100">
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
  const [requireConfidence, setRequireConfidence] = useState(quiz.requireConfidence);
  const [timeLimitEnabled, setTimeLimitEnabled] = useState(quiz.timeLimitSec !== null);
  const [timeLimitMin, setTimeLimitMin] = useState(
    quiz.timeLimitSec !== null ? Math.max(1, Math.round(quiz.timeLimitSec / 60)) : 15,
  );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const timeLimitSec = timeLimitEnabled ? Math.max(1, timeLimitMin) * 60 : null;
    const res = await fetch(apiUrl(`/api/quizzes/${quiz.id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        difficulty,
        requireConfidence,
        timeLimitSec,
      }),
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
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={requireConfidence}
            onChange={(e) => setRequireConfidence(e.target.checked)}
            className="h-4 w-4 rounded border-token accent-brand-600"
          />
          <span>Yêu cầu đánh giá độ tự tin</span>
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={timeLimitEnabled}
            onChange={(e) => setTimeLimitEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-token accent-brand-600"
          />
          <span>Giới hạn thời gian</span>
        </label>
        {timeLimitEnabled && (
          <label className="flex items-center gap-2 text-xs">
            <input
              type="number"
              min={1}
              max={1440}
              value={timeLimitMin}
              onChange={(e) => setTimeLimitMin(Number(e.target.value))}
              className="input w-16"
            />
            <span className="text-muted">phút</span>
          </label>
        )}
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
