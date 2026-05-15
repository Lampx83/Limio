"use client";

import type { Dispatch } from "react";
import type { WizardState, DistributionMode } from "../useWizardState";

const MODES: { value: DistributionMode; label: string; desc: string; recommended?: boolean }[] = [
  {
    value: "single",
    label: "Một đề chung cho cả lớp",
    desc: "Tất cả học sinh làm cùng câu, cùng thứ tự.",
  },
  {
    value: "shuffled_per_student",
    label: "Xáo trộn cho mỗi học sinh",
    desc: "Mỗi học sinh nhận bộ câu hỏi khác nhau rút từ ngân hàng. Khó copy bài, công bằng vì cùng cấu trúc đề.",
    recommended: true,
  },
  {
    value: "multi_session",
    label: "Chia lớp làm nhiều ca thi",
    desc: "Mỗi ca một đề riêng có câu chung để đảm bảo công bằng điểm.",
  },
];

interface Props {
  state: WizardState;
  dispatch: Dispatch<{ type: string; [k: string]: unknown }>;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
}

function toLocalInput(d: Date): string {
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

export default function Step3Distribution({ state, dispatch, onBack, onSubmit, submitting }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Bước 3/3 — Phát đề cho học sinh</h2>
        <p className="mt-1 text-sm text-faint">Chọn cách phát đề và thời gian mở.</p>
      </div>

      {/* Distribution mode */}
      <div className="space-y-2">
        {MODES.map((mode) => (
          <label
            key={mode.value}
            className="flex cursor-pointer items-start gap-3 rounded border border-default p-3 hover:bg-surface"
          >
            <input
              type="radio"
              name="distributionMode"
              value={mode.value}
              checked={state.distributionMode === mode.value}
              onChange={() => dispatch({ type: "SET_DISTRIBUTION_MODE", distributionMode: mode.value })}
              className="mt-1 accent-blue-600"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                {mode.label}
                {mode.recommended && (
                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">Khuyên dùng</span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-faint">{mode.desc}</p>

              {/* Multi-session sub-options */}
              {mode.value === "multi_session" && state.distributionMode === "multi_session" && (
                <div className="mt-3 space-y-3 border-l-2 border-blue-200 pl-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium">Số ca:</label>
                    <select
                      value={state.sessionCount}
                      onChange={(e) => dispatch({ type: "SET_SESSION_COUNT", sessionCount: Number(e.target.value) })}
                      className="rounded border border-default px-2 py-1 text-xs"
                    >
                      {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                        <option key={n} value={n}>{n} ca</option>
                      ))}
                    </select>
                  </div>
                  <label className="flex cursor-pointer items-start gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={state.autoEquating}
                      onChange={(e) => dispatch({ type: "SET_AUTO_EQUATING", autoEquating: e.target.checked })}
                      className="mt-0.5 accent-blue-600"
                    />
                    <span>
                      Tự cân bằng điểm giữa các ca
                      <span className="ml-1 text-faint">
                        (Hệ thống tự điều chỉnh để học sinh ca khó không bị thiệt điểm)
                      </span>
                    </span>
                  </label>
                </div>
              )}
            </div>
          </label>
        ))}
      </div>

      {/* Schedule */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-faint mb-1">Mở đề từ</label>
          <input
            type="datetime-local"
            value={state.openAt}
            onChange={(e) => dispatch({ type: "SET_OPEN_AT", openAt: e.target.value })}
            className="w-full rounded border border-default px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-faint mb-1">Đến</label>
          <input
            type="datetime-local"
            value={state.closeAt}
            onChange={(e) => dispatch({ type: "SET_CLOSE_AT", closeAt: e.target.value })}
            className="w-full rounded border border-default px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      {/* Show results */}
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={state.showResultsAfterSubmit}
          onChange={(e) => dispatch({ type: "SET_SHOW_RESULTS", showResultsAfterSubmit: e.target.checked })}
          className="accent-blue-600"
        />
        Cho phép học sinh xem lại đáp án và giải thích sau khi có điểm
      </label>

      <div className="flex justify-between pt-2">
        <button type="button" onClick={onBack} className="text-sm text-faint hover:text-default">
          ← Quay lại
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={onSubmit}
          className="rounded bg-blue-600 px-6 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {submitting ? "Đang tạo…" : "Tạo đề"}
        </button>
      </div>
    </div>
  );
}
