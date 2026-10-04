"use client";

import { useEffect } from "react";
import { UserAvatar, StatusBadge, DateTime } from "@/components/ui";
import GradeForm from "./GradeForm";
import AttachmentPreview from "./AttachmentPreview";

export default function SubmissionModal({
  user,
  submission,
  maxScore,
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
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

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
        <header className="flex items-center justify-between gap-3 border-b border-token px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <UserAvatar name={user.displayName} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">
                {user.displayName}
              </p>
              <p className="truncate text-xs text-faint">{user.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary btn-sm shrink-0"
            aria-label="Đóng"
          >
            ✕ Đóng
          </button>
        </header>

        <div className="max-h-[75vh] overflow-y-auto p-5">
          <div
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
                />
              </div>
            </div>
          </div>
        </div>

        <footer className="border-t border-token px-5 py-3 text-right">
          <button type="button" onClick={onClose} className="btn-secondary btn-sm">
            ← Quay lại danh sách
          </button>
        </footer>
      </div>
    </div>
  );
}
