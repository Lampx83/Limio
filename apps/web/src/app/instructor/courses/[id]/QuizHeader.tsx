"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { fromDateTimeInputValue, toDateTimeInputValue } from "@/lib/datetime";
import { toast } from "@/lib/toast";
import { SHOW_QUIZ_CONFIDENCE, SHOW_QUIZ_DIFFICULTY } from "./quizEditorFlags";

export type ScoringPolicy = "highest" | "latest" | "average";

export const SCORING_POLICY_LABEL: Record<ScoringPolicy, string> = {
  highest: "Cao nhất",
  latest: "Lần cuối",
  average: "Trung bình",
};

const SCORING_POLICY_HINT: Record<ScoringPolicy, string> = {
  highest: "Lấy điểm cao nhất trong các lần làm",
  latest: "Lấy điểm của lần nộp cuối cùng",
  average: "Lấy điểm trung bình của các lần làm",
};

interface Quiz {
  id: string;
  title: string;
  difficulty: number | null;
  requireConfidence: boolean;
  timeLimitSec: number | null;
  maxAttempts: number | null;
  /** ISO UTC; null = không có hạn hoàn thành. */
  dueAt?: string | null;
  /** ISO UTC; null = mở ngay. */
  opensAt?: string | null;
  scoringPolicy?: ScoringPolicy;
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

/** Ô cài đặt: nhãn (kèm công tắc bật/tắt nếu là tuỳ chọn) + phần điều khiển bên dưới. */
function SettingCell({
  id,
  label,
  enabled,
  onToggle,
  hint,
  children,
  className = "",
}: {
  id: string;
  label: string;
  /** undefined = luôn bật, không có công tắc. */
  enabled?: boolean;
  onToggle?: (v: boolean) => void;
  hint?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-token bg-[rgb(var(--surface))] p-2.5 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs font-semibold text-default">
          {label}
        </label>
        {onToggle && (
          <input
            id={id}
            type="checkbox"
            role="switch"
            checked={!!enabled}
            onChange={(e) => onToggle(e.target.checked)}
            className="h-4 w-4 cursor-pointer rounded border-token accent-brand-600"
          />
        )}
      </div>
      <div className="mt-1.5 text-sm">
        {(enabled ?? true) ? children : <span className="text-muted">{hint}</span>}
      </div>
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
  const [scoringPolicy, setScoringPolicy] = useState<ScoringPolicy>(quiz.scoringPolicy ?? "highest");
  const [opensEnabled, setOpensEnabled] = useState(!!quiz.opensAt);
  const [opensLocal, setOpensLocal] = useState(quiz.opensAt ? toDateTimeInputValue(quiz.opensAt) : "");
  const [dueEnabled, setDueEnabled] = useState(!!quiz.dueAt);
  const [dueLocal, setDueLocal] = useState(quiz.dueAt ? toDateTimeInputValue(quiz.dueAt) : "");
  const [error, setError] = useState<string | null>(null);
  const [timeLimitEnabled, setTimeLimitEnabled] = useState(quiz.timeLimitSec !== null);
  const [timeLimitMin, setTimeLimitMin] = useState(
    quiz.timeLimitSec !== null ? Math.max(1, Math.round(quiz.timeLimitSec / 60)) : 15,
  );

  // Một lần làm thì không có gì để gộp — ẩn ô cách tính điểm cho đỡ rối.
  const singleAttempt = attemptsLimited && Math.round(maxAttempts) === 1;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const opensAt = opensEnabled ? fromDateTimeInputValue(opensLocal) : null;
    if (opensEnabled && !opensAt) {
      setError("Chọn ngày giờ cho hạn mở, hoặc tắt hạn mở.");
      return;
    }
    const dueAt = dueEnabled ? fromDateTimeInputValue(dueLocal) : null;
    if (dueEnabled && !dueAt) {
      setError("Chọn ngày giờ cho hạn đóng, hoặc tắt hạn đóng.");
      return;
    }
    if (opensAt && dueAt && new Date(opensAt).getTime() >= new Date(dueAt).getTime()) {
      setError("Hạn mở phải trước hạn đóng.");
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
          scoringPolicy,
          opensAt,
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

  const numInput = "input h-7 w-16 px-1.5 py-0 text-center text-sm";
  const dateInput = "input h-7 w-full px-1.5 py-0 text-sm";

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

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <SettingCell
          id="quiz-time-limit"
          label="Thời gian làm bài"
          enabled={timeLimitEnabled}
          onToggle={setTimeLimitEnabled}
          hint="Không giới hạn"
        >
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              max={1440}
              value={timeLimitMin}
              onChange={(e) => setTimeLimitMin(Number(e.target.value))}
              aria-label="Số phút tối đa"
              className={numInput}
            />
            <span className="text-muted">phút</span>
          </div>
        </SettingCell>

        <SettingCell
          id="quiz-attempts-limit"
          label="Số lần làm"
          enabled={attemptsLimited}
          onToggle={setAttemptsLimited}
          hint="Không giới hạn"
        >
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              max={100}
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(Number(e.target.value))}
              aria-label="Số lần làm tối đa"
              className={numInput}
            />
            <span className="text-muted">lần tối đa</span>
          </div>
        </SettingCell>

        <SettingCell
          id="quiz-opens"
          label="Hạn mở"
          enabled={opensEnabled}
          onToggle={(v) => {
            setOpensEnabled(v);
            if (v && !opensLocal) setOpensLocal(toDateTimeInputValue(new Date()));
          }}
          hint="Mở ngay"
        >
          <input
            type="datetime-local"
            value={opensLocal}
            onChange={(e) => setOpensLocal(e.target.value)}
            aria-label="Hạn mở (giờ Việt Nam)"
            className={dateInput}
          />
        </SettingCell>

        <SettingCell
          id="quiz-due"
          label="Hạn đóng"
          enabled={dueEnabled}
          onToggle={(v) => {
            setDueEnabled(v);
            if (v && !dueLocal) {
              setDueLocal(toDateTimeInputValue(new Date(Date.now() + 7 * 86_400_000)));
            }
          }}
          hint="Không có hạn"
        >
          <input
            type="datetime-local"
            value={dueLocal}
            onChange={(e) => setDueLocal(e.target.value)}
            aria-label="Hạn đóng (giờ Việt Nam)"
            className={dateInput}
          />
        </SettingCell>

        {!singleAttempt && (
          <SettingCell
            id="quiz-scoring"
            label="Cách tính điểm khi làm nhiều lần"
            className="sm:col-span-2"
          >
            <div
              role="radiogroup"
              aria-label="Cách tính điểm khi làm nhiều lần"
              title={SCORING_POLICY_HINT[scoringPolicy]}
              className="inline-flex overflow-hidden rounded-lg border border-token"
            >
              {(Object.keys(SCORING_POLICY_LABEL) as ScoringPolicy[]).map((k, i) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={scoringPolicy === k}
                  onClick={() => setScoringPolicy(k)}
                  className={`h-7 px-3 text-xs font-medium transition ${i > 0 ? "border-l border-token" : ""} ${
                    scoringPolicy === k
                      ? "bg-brand-600 text-white"
                      : "bg-[rgb(var(--surface))] text-fg hover:bg-[rgb(var(--surface-muted))]"
                  }`}
                >
                  {SCORING_POLICY_LABEL[k]}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted">{SCORING_POLICY_HINT[scoringPolicy]}</p>
          </SettingCell>
        )}

        {SHOW_QUIZ_DIFFICULTY && (
          <SettingCell id="quiz-difficulty" label="Độ khó (1 dễ – 5 khó)">
            <div role="radiogroup" aria-label="Độ khó" className="inline-flex overflow-hidden rounded-lg border border-token">
              {[1, 2, 3, 4, 5].map((level) => (
                <button
                  key={level}
                  type="button"
                  role="radio"
                  aria-checked={difficulty === level}
                  onClick={() => setDifficulty(level)}
                  className={`h-7 w-7 text-xs font-medium tabular-nums transition ${level > 1 ? "border-l border-token" : ""} ${
                    difficulty === level
                      ? "bg-brand-600 text-white"
                      : "bg-[rgb(var(--surface))] text-fg hover:bg-[rgb(var(--surface-muted))]"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </SettingCell>
        )}

        {SHOW_QUIZ_CONFIDENCE && (
          <SettingCell
            id="quiz-confidence"
            label="Đánh giá độ tự tin"
            enabled={requireConfidence}
            onToggle={setRequireConfidence}
            hint="Tắt"
          >
            <span className="text-muted">Người học chọn mức tự tin sau mỗi câu</span>
          </SettingCell>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-xs text-muted">
          Giờ theo múi giờ Việt Nam. Trước hạn mở hoặc sau hạn đóng, học viên không bắt đầu được lượt làm mới
          (lượt đang làm dở vẫn nộp được).
        </p>
        <button type="submit" disabled={busy} className="btn-primary btn-sm">
          {busy ? "Đang lưu…" : "Lưu"}
        </button>
        <button type="button" onClick={onClose} disabled={busy} className="btn-secondary btn-sm">
          Hủy
        </button>
      </div>
      {error && (
        <p role="alert" className="banner-danger text-sm">
          {error}
        </p>
      )}
    </form>
  );
}
