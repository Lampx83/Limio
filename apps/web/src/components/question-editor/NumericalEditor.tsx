"use client";

import type { NumericalDraft } from "./types";

/**
 * Đợt 6 — editor DÙNG CHUNG cho loại "Đáp án dạng số" (canonical
 * NumericalDraft: { expected, tolerance }). Component đứng riêng, không đụng
 * gì của Quiz (Quiz vẫn dùng field number rời trong AddQuestionForm.tsx cho
 * tới khi có Đợt Quiz-adapter).
 */
export default function NumericalEditor({
  value,
  onChange,
}: {
  value: NumericalDraft;
  onChange: (next: NumericalDraft) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="block">
        <span className="block text-xs font-medium text-slate-600">Đáp án (số)</span>
        <input
          type="number"
          step="any"
          required
          value={value.expected ?? ""}
          onChange={(e) =>
            onChange({ ...value, expected: e.target.value === "" ? null : Number(e.target.value) })
          }
          className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm"
        />
      </label>
      <label className="block">
        <span className="block text-xs font-medium text-slate-600">Sai số cho phép</span>
        <input
          type="number"
          step="any"
          min={0}
          value={value.tolerance}
          onChange={(e) => onChange({ ...value, tolerance: Number(e.target.value) || 0 })}
          className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm"
        />
      </label>
    </div>
  );
}
