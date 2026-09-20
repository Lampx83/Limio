"use client";

/**
 * Đầu form câu hỏi dùng chung cho AddQuestionForm và EditQuestionForm để hai
 * form luôn cùng bố cục: nhãn trên, điều khiển cao đúng 40px dưới nhãn.
 * `onChangeType` chỉ có ở form thêm (câu đã tạo không đổi loại được).
 */
export const FIELD_LABEL =
  "mb-1.5 block text-xs font-semibold uppercase leading-4 tracking-wide text-muted";

export default function QuestionFormHeader({
  typeLabel,
  points,
  onPoints,
  onChangeType,
}: {
  typeLabel: string;
  points: number;
  onPoints: (n: number) => void;
  onChangeType?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <span className={FIELD_LABEL}>Loại câu hỏi</span>
        <div className="flex h-10 items-center gap-2">
          <div className="flex h-10 items-center rounded-lg border border-brand-200 bg-brand-soft px-3 text-sm font-semibold text-brand-700">
            {typeLabel}
          </div>
          {onChangeType && (
            <button type="button" onClick={onChangeType} className="btn-secondary btn-sm">
              Đổi loại
            </button>
          )}
        </div>
      </div>
      <label className="block">
        <span className={FIELD_LABEL}>Điểm</span>
        <input
          type="number"
          min={1}
          max={100}
          value={points}
          onChange={(e) => onPoints(Number(e.target.value))}
          className="input h-10 w-20"
        />
      </label>
    </div>
  );
}
