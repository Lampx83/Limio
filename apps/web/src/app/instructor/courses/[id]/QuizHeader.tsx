"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { fromDateTimeInputValue, toDateTimeInputValue } from "@/lib/datetime";
import { toast } from "@/lib/toast";
import { SHOW_QUIZ_CONFIDENCE, SHOW_QUIZ_DIFFICULTY } from "./quizEditorFlags";

interface Quiz {
  id: string;
  title: string;
  difficulty: number | null;
  requireConfidence: boolean;
  timeLimitSec: number | null;
  maxAttempts: number | null;
  /** ISO UTC; null = không có hạn hoàn thành. */
  dueAt?: string | null;
  isHidden: boolean;
}

/** Compact button group (eye / edit / delete) for the quiz section header. */
export function QuizActionButtons({ quiz }: { quiz: Quiz }) {
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
  const [attemptsLimited, setAttemptsLimited] = useState(quiz.maxAttempts !== null);
  const [maxAttempts, setMaxAttempts] = useState(quiz.maxAttempts ?? 3);
  const [dueEnabled, setDueEnabled] = useState(!!quiz.dueAt);
  const [dueLocal, setDueLocal] = useState(quiz.dueAt ? toDateTimeInputValue(quiz.dueAt) : "");
  const [error, setError] = useState<string | null>(null);
  const [timeLimitEnabled, setTimeLimitEnabled] = useState(quiz.timeLimitSec !== null);
  const [timeLimitMin, setTimeLimitMin] = useState(
    quiz.timeLimitSec !== null ? Math.max(1, Math.round(quiz.timeLimitSec / 60)) : 15,
  );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const dueAt = dueEnabled ? fromDateTimeInputValue(dueLocal) : null;
    if (dueEnabled && !dueAt) {
      setError("Chọn ngày giờ cho hạn hoàn thành, hoặc tắt hạn hoàn thành.");
      return;
    }
    setBusy(true);
    const timeLimitSec = timeLimitEnabled ? Math.max(1, timeLimitMin) * 60 : null;
    try {
      const res = await fetch(apiUrl(`/api/quizzes/${quiz.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          // Trường đang ẩn UI thì không gửi, để không ghi đè giá trị đã lưu.
          ...(SHOW_QUIZ_DIFFICULTY ? { difficulty } : {}),
          ...(SHOW_QUIZ_CONFIDENCE ? { requireConfidence } : {}),
          timeLimitSec,
          maxAttempts: attemptsLimited ? Math.min(100, Math.max(1, Math.round(maxAttempts) || 1)) : null,
          dueAt,
        }),
      });
      if (res.ok) {
        toast.success("Đã lưu cài đặt quiz");
        onClose();
        router.refresh();
      } else {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(`Chưa lưu được cài đặt quiz (${d.error ?? res.statusText}).`);
      }
    } catch {
      setError("Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.");
    } finally {
      setBusy(false);
    }
  }

  const chip =
    "inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-token bg-[rgb(var(--surface))] px-2.5 text-sm transition hover:border-brand-400";

  return (
    <form onSubmit={save} className="space-y-2.5 rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        aria-label="Tên bài kiểm tra"
        placeholder="Tên bài kiểm tra"
        className="input w-full"
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {SHOW_QUIZ_DIFFICULTY && (
        <div className="flex items-center gap-2">
          <span id="quiz-difficulty-label" className="text-xs font-medium text-muted">
            Độ khó
          </span>
          <div
            role="radiogroup"
            aria-labelledby="quiz-difficulty-label"
            title="1 dễ, 5 khó"
            className="inline-flex overflow-hidden rounded-lg border border-token"
          >
            {[1, 2, 3, 4, 5].map((level) => (
              <button
                key={level}
                type="button"
                role="radio"
                aria-checked={difficulty === level}
                onClick={() => setDifficulty(level)}
                className={`h-8 w-8 text-sm font-medium tabular-nums transition ${level > 1 ? "border-l border-token" : ""} ${
                  difficulty === level
                    ? "bg-brand-600 text-white"
                    : "bg-[rgb(var(--surface))] text-fg hover:bg-[rgb(var(--surface-muted))]"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
        )}

        {SHOW_QUIZ_CONFIDENCE && (
        <label className={chip} title="Người học chọn mức tự tin sau mỗi câu trả lời">
          <input
            type="checkbox"
            checked={requireConfidence}
            onChange={(e) => setRequireConfidence(e.target.checked)}
            className="h-4 w-4 rounded border-token accent-brand-600"
          />
          Đánh giá độ tự tin
        </label>
        )}

        <div className={chip.replace("cursor-pointer ", "")}>
          <input
            id="quiz-time-limit"
            type="checkbox"
            checked={timeLimitEnabled}
            onChange={(e) => setTimeLimitEnabled(e.target.checked)}
            className="h-4 w-4 cursor-pointer rounded border-token accent-brand-600"
          />
          <label htmlFor="quiz-time-limit" className="cursor-pointer">
            Giới hạn thời gian
          </label>
          {timeLimitEnabled && (
            <>
              <input
                type="number"
                min={1}
                max={1440}
                value={timeLimitMin}
                onChange={(e) => setTimeLimitMin(Number(e.target.value))}
                aria-label="Số phút tối đa"
                className="input h-6 w-14 px-1.5 py-0 text-center text-sm"
              />
              <span className="text-muted">phút</span>
            </>
          )}
        </div>

        <div className={chip.replace("cursor-pointer ", "")}>
          <input
            id="quiz-attempts-limit"
            type="checkbox"
            checked={attemptsLimited}
            onChange={(e) => setAttemptsLimited(e.target.checked)}
            className="h-4 w-4 cursor-pointer rounded border-token accent-brand-600"
          />
          <label htmlFor="quiz-attempts-limit" className="cursor-pointer">
            Giới hạn số lần làm
          </label>
          {attemptsLimited ? (
            <>
              <input
                type="number"
                min={1}
                max={100}
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(Number(e.target.value))}
                aria-label="Số lần làm tối đa"
                className="input h-6 w-14 px-1.5 py-0 text-center text-sm"
              />
              <span className="text-muted">lần</span>
            </>
          ) : (
            <span className="text-muted">(không giới hạn)</span>
          )}
        </div>

        <div className={chip.replace("cursor-pointer ", "")}>
          <input
            id="quiz-due"
            type="checkbox"
            checked={dueEnabled}
            onChange={(e) => {
              setDueEnabled(e.target.checked);
              if (e.target.checked && !dueLocal) {
                setDueLocal(toDateTimeInputValue(new Date(Date.now() + 7 * 86_400_000)));
              }
            }}
            className="h-4 w-4 cursor-pointer rounded border-token accent-brand-600"
          />
          <label htmlFor="quiz-due" className="cursor-pointer">
            Hạn hoàn thành
          </label>
          {dueEnabled ? (
            <input
              type="datetime-local"
              value={dueLocal}
              onChange={(e) => setDueLocal(e.target.value)}
              aria-label="Hạn hoàn thành (giờ Việt Nam)"
              className="input h-6 px-1.5 py-0 text-sm"
            />
          ) : (
            <span className="text-muted">(không có hạn)</span>
          )}
        </div>

        <div className="ml-auto flex gap-2">
          <button type="submit" disabled={busy} className="btn-primary btn-sm">
            {busy ? "Đang lưu…" : "Lưu"}
          </button>
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary btn-sm">
            Hủy
          </button>
        </div>
      </div>
      <p className="text-xs text-muted">
        Hạn hoàn thành tính theo giờ Việt Nam. Quá hạn, học viên không bắt đầu được lượt làm mới
        (lượt đang làm dở vẫn nộp được).
      </p>
      {error && (
        <p role="alert" className="banner-danger text-sm">
          {error}
        </p>
      )}
    </form>
  );
}
