"use client";

interface ReviewItem {
  questionId: string;
  displayNumber: number;
  groupLabel: string;
  answered: boolean;
}

interface Props {
  open: boolean;
  items: ReviewItem[];
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onJump: (questionId: string) => void;
}

/**
 * Pre-submit review. Lists unanswered questions with jump-back links so the
 * learner doesn't accidentally submit a partial attempt. They can still
 * choose to submit anyway.
 */
export default function SubmitReviewModal({
  open,
  items,
  submitting,
  onCancel,
  onConfirm,
  onJump,
}: Props) {
  if (!open) return null;
  const unanswered = items.filter((i) => !i.answered);
  const answered = items.length - unanswered.length;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-review-title"
    >
      <div className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="border-b border-default px-5 py-3">
          <h2 id="submit-review-title" className="text-base font-semibold">
            Xem lại trước khi nộp bài
          </h2>
        </div>

        <div className="px-5 py-4 text-sm">
          <p className="mb-3">
            Bạn đã trả lời{" "}
            <span className="font-semibold text-emerald-700">{answered}</span>
            {" / "}
            {items.length} câu hỏi.
          </p>

          {unanswered.length === 0 ? (
            <div className="rounded border border-emerald-300 bg-emerald-50 p-3 text-emerald-800">
              ✓ Bạn đã trả lời tất cả các câu. Sẵn sàng nộp bài.
            </div>
          ) : (
            <div>
              <p className="mb-2 font-medium text-amber-800">
                {unanswered.length} câu chưa trả lời:
              </p>
              <ul className="max-h-64 space-y-1 overflow-y-auto rounded border border-amber-200 bg-amber-50 p-2">
                {unanswered.map((u) => (
                  <li key={u.questionId}>
                    <button
                      type="button"
                      onClick={() => {
                        onCancel();
                        onJump(u.questionId);
                      }}
                      className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left hover:bg-amber-100"
                    >
                      <span>
                        <span className="font-medium">Câu {u.displayNumber}</span>
                        <span className="ml-2 text-xs text-faint">
                          {u.groupLabel}
                        </span>
                      </span>
                      <span className="text-xs text-blue-700">Đến câu này →</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-faint">
                Các câu chưa trả lời sẽ bị tính 0 điểm. Bạn vẫn có thể nộp bài
                nếu đã chắc chắn.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-default px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded border border-default px-4 py-1.5 text-sm disabled:opacity-50"
          >
            Quay lại làm tiếp
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className={`rounded px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${
              unanswered.length > 0
                ? "bg-amber-600 hover:bg-amber-700"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {submitting
              ? "Đang nộp…"
              : unanswered.length > 0
                ? "Vẫn nộp bài"
                : "Nộp bài"}
          </button>
        </div>
      </div>
    </div>
  );
}
