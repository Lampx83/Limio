"use client";

import { useCallback, useEffect, useRef } from "react";
import { UserAvatar, StatusBadge, DateTime } from "@/components/ui";
import GradeForm from "./GradeForm";
import AttachmentPreview from "./AttachmentPreview";

export type SubmissionNav = {
  position: number;
  total: number;
  pendingOnly: boolean;
  onTogglePendingOnly: (v: boolean) => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
};

export default function SubmissionModal({
  user,
  submission,
  maxScore,
  nav,
  onClose,
}: {
  user: { displayName: string; email: string };
  submission: {
    id: string;
    status: "submitted" | "graded";
    body: string;
    attachmentUrl: string | null;
    submittedAt: Date;
    score: number | null;
    feedback: string | null;
  };
  maxScore: number;
  nav?: SubmissionNav | null;
  onClose: () => void;
}) {
  // Điểm/nhận xét đang soạn dở: chuyển bài sẽ mất, nên hỏi trước.
  const dirtyRef = useRef(false);
  const setDirty = useCallback((d: boolean) => {
    dirtyRef.current = d;
  }, []);
  const go = useCallback((fn: (() => void) | null | undefined) => {
    if (!fn) return;
    if (
      dirtyRef.current &&
      !window.confirm("Điểm/nhận xét bài này chưa lưu và sẽ mất. Vẫn chuyển sang bài khác?")
    )
      return;
    fn();
  }, []);
  const onPrev = nav?.onPrev;
  const onNext = nav?.onNext;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      // ← → chuyển bài, trừ khi đang gõ trong ô nhập (mũi tên là di chuyển con trỏ).
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      go(e.key === "ArrowLeft" ? onPrev : onNext);
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, go, onPrev, onNext]);

  const isGraded = submission.status === "graded";
  const hasAttachment = !!submission.attachmentUrl;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Bài làm của ${user.displayName}`}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className={`w-full rounded-2xl bg-[rgb(var(--surface))] shadow-2xl ${
          hasAttachment ? "max-w-2xl lg:max-w-6xl" : "max-w-2xl"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-token px-5 py-4">
          <div className="flex w-full min-w-0 items-center gap-3 sm:w-auto sm:flex-1">
            <UserAvatar name={user.displayName} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">
                {user.displayName}
              </p>
              <p className="truncate text-xs text-faint">{user.email}</p>
            </div>
          </div>
          <div className="flex w-full shrink-0 items-center justify-between gap-2 sm:w-auto sm:justify-end">
            {nav && (
              <div className="flex items-center gap-1" role="group" aria-label="Chuyển bài nộp">
                <button
                  type="button"
                  onClick={() => go(nav.onPrev)}
                  disabled={!nav.onPrev}
                  className="btn-secondary btn-sm"
                  aria-label="Bài trước"
                  title="Bài trước (←)"
                >
                  ← <span className="hidden sm:inline">Trước</span>
                </button>
                <span className="min-w-[3.5rem] text-center text-xs tabular-nums text-muted" aria-live="polite">
                  {nav.position > 0 ? `${nav.position}/${nav.total}` : "—"}
                </span>
                <button
                  type="button"
                  onClick={() => go(nav.onNext)}
                  disabled={!nav.onNext}
                  className="btn-secondary btn-sm"
                  aria-label="Bài sau"
                  title="Bài sau (→)"
                >
                  <span className="hidden sm:inline">Sau</span> →
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary btn-sm"
              aria-label="Đóng"
            >
              ✕ Đóng
            </button>
          </div>
        </header>

        <div className="max-h-[75vh] overflow-y-auto p-5">
          <div
            key={submission.id}
            className={
              hasAttachment ? "grid gap-5 lg:grid-cols-2 lg:items-start" : ""
            }
          >
            {submission.attachmentUrl && (
              <div className="lg:sticky lg:top-0">
                <AttachmentPreview url={submission.attachmentUrl} />
              </div>
            )}

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StatusBadge tone={isGraded ? "success" : "warning"} pulse={!isGraded}>
                  {isGraded ? "Đã chấm" : "Chờ chấm"}
                </StatusBadge>
                <DateTime
                  value={submission.submittedAt}
                  format="datetime"
                  className="text-xs text-muted"
                />
              </div>

              <p className="mt-4 whitespace-pre-wrap rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-4 text-sm">
                {submission.body}
              </p>

              <div className="mt-4 border-t border-token pt-4">
                <GradeForm
                  submissionId={submission.id}
                  maxScore={maxScore}
                  initialScore={submission.score}
                  initialFeedback={submission.feedback}
                  isGraded={isGraded}
                  onDirtyChange={setDirty}
                />
              </div>
            </div>
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-token px-5 py-3">
          {nav ? (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={nav.pendingOnly}
                onChange={(e) => nav.onTogglePendingOnly(e.target.checked)}
              />
              Chỉ chuyển qua bài chờ chấm
            </label>
          ) : (
            <span />
          )}
          <button type="button" onClick={onClose} className="btn-secondary btn-sm">
            ← Quay lại danh sách
          </button>
        </footer>
      </div>
    </div>
  );
}
