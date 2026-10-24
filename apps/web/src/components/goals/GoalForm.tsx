"use client";

import { useState } from "react";
import {
  GOAL_CUSTOM_LABEL_MAX,
  GOAL_FRAMEWORKS,
  GOAL_FRAMEWORK_LABEL,
  GOAL_HOURS_PER_WEEK_MAX,
  GOAL_HOURS_PER_WEEK_MIN,
  goalLevelOptions,
  type GoalFramework,
} from "@feedbackme/shared-types";

export interface GoalFormValues {
  framework: GoalFramework;
  targetLevel: string;
  /** YYYY-MM-DD; chuỗi rỗng = chưa chọn (chỉ cho phép ở mục tiêu của lớp). */
  targetDate: string;
  hoursPerWeek: number | null;
}

const ERRORS: Record<string, string> = {
  target_level_invalid: "Cấp độ chưa hợp lệ với khung đã chọn.",
  target_date_invalid: "Ngày chưa hợp lệ.",
  target_date_not_future: "Hạn phải sau hôm nay.",
  target_date_too_far: "Hạn quá xa (tối đa 10 năm).",
  target_date_required: "Cần chọn hạn cho mục tiêu này.",
  goal_exists: "Đã có một mục tiêu đang theo đuổi cho khoá này. Đổi mục tiêu đó hoặc lưu trữ nó trước.",
  not_enrolled: "Chưa tham gia khoá học này.",
  goal_not_active: "Mục tiêu đã đóng; bấm \"Theo đuổi lại\" rồi mới sửa được.",
  no_section_goal: "Lớp chưa đặt mục tiêu.",
  forbidden: "Không có quyền thực hiện việc này.",
  validation_failed: "Thông tin chưa hợp lệ. Số giờ mỗi tuần từ 0,5 đến 60.",
};
export const goalErrorText = (code?: string) => ERRORS[code ?? ""] ?? `Có lỗi xảy ra${code ? ` (${code})` : ""}. Thử lại sau.`;

/** Ngày mai theo giờ VN, dạng YYYY-MM-DD: hạn sớm nhất chọn được. */
function tomorrowVN(): string {
  return new Date(Date.now() + 7 * 3600_000 + 86_400_000).toISOString().slice(0, 10);
}

export default function GoalForm({
  initial,
  submitLabel,
  dateOptional = false,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<GoalFormValues>;
  submitLabel: string;
  /** Mục tiêu của lớp có thể không có hạn. */
  dateOptional?: boolean;
  onSubmit: (v: GoalFormValues) => Promise<string | null>;
  onCancel?: () => void;
}) {
  const [framework, setFramework] = useState<GoalFramework>(initial?.framework ?? "HSK");
  const [level, setLevel] = useState(initial?.targetLevel ?? goalLevelOptions(initial?.framework ?? "HSK")[0] ?? "");
  const [date, setDate] = useState(initial?.targetDate ?? "");
  const [hours, setHours] = useState(initial?.hoursPerWeek != null ? String(initial.hoursPerWeek) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = goalLevelOptions(framework);
  const changeFramework = (f: GoalFramework) => {
    setFramework(f);
    setLevel(f === "custom" ? "" : (goalLevelOptions(f)[0] ?? ""));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!date && !dateOptional) return setError(goalErrorText("target_date_required"));
    setBusy(true);
    try {
      const h = hours.trim() === "" ? null : Number(hours.replace(",", "."));
      if (h !== null && (!Number.isFinite(h) || h < GOAL_HOURS_PER_WEEK_MIN || h > GOAL_HOURS_PER_WEEK_MAX)) {
        setError(goalErrorText("validation_failed"));
        return;
      }
      setError(await onSubmit({ framework, targetLevel: level, targetDate: date, hoursPerWeek: h }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm">
        <span className="text-meta">Khung năng lực</span>
        <select className="input mt-1 w-full" value={framework} onChange={(e) => changeFramework(e.target.value as GoalFramework)}>
          {GOAL_FRAMEWORKS.map((f) => (
            <option key={f} value={f}>
              {GOAL_FRAMEWORK_LABEL[f]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-meta">Cấp độ muốn đạt</span>
        {framework === "custom" ? (
          <input className="input mt-1 w-full" maxLength={GOAL_CUSTOM_LABEL_MAX} placeholder="Ví dụ: Giao tiếp được khi đi du lịch" value={level} onChange={(e) => setLevel(e.target.value)} />
        ) : (
          <select className="input mt-1 w-full" value={level} onChange={(e) => setLevel(e.target.value)}>
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        )}
      </label>
      <label className="block text-sm">
        <span className="text-meta">Hạn đạt mục tiêu{dateOptional ? " (không bắt buộc)" : ""}</span>
        <input type="date" className="input mt-1 w-full" min={tomorrowVN()} value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label className="block text-sm">
        <span className="text-meta">Số giờ học mỗi tuần (không bắt buộc)</span>
        <input
          inputMode="decimal"
          className="input mt-1 w-full"
          placeholder="Ví dụ: 4"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
        />
      </label>
      {error && (
        <p className="banner-danger text-sm sm:col-span-2" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button type="submit" className="btn-primary" disabled={busy || !level.trim()}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn-ghost" disabled={busy} onClick={onCancel}>
            Huỷ
          </button>
        )}
      </div>
    </form>
  );
}
