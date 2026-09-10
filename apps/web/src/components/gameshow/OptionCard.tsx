"use client";

import { Check } from "lucide-react";

// Thẻ đáp án tối giản/tactile dùng chung cho CẢ màn học viên (play/[code])
// lẫn màn host (HostGameClient) — thay hẳn palette 4 màu + icon hình khối
// (tam giác/kim cương/tròn/vuông) kiểu Kahoot bằng nhãn chữ cái trung tính,
// chỉ đổi màu theo TRẠNG THÁI (đang chọn/đúng/sai/mờ đi) chứ không theo vị
// trí. `dark` chỉnh nền cho phù hợp phông tối (host, reveal, xem lại câu
// hỏi) so với phông sáng (màn học viên lúc đang trả lời).

export const OPTION_LETTERS = ["A", "B", "C", "D"];

export type OptionState = "idle" | "selected" | "dimmed" | "correct" | "incorrect";

export function OptionCard({
  letter,
  label,
  state,
  onClick,
  disabled,
  dark = false,
  compact = false,
  tiltSign = -1,
}: {
  letter: string;
  label: string;
  state: OptionState;
  onClick?: () => void;
  disabled?: boolean;
  dark?: boolean;
  compact?: boolean;
  tiltSign?: 1 | -1;
}) {
  const base = dark
    ? "border-white/15 bg-white/10 text-white"
    : "border-slate-200 bg-white text-slate-900";
  const shadowColor = dark ? "#00000055" : "#cbd5e1";

  const stateClasses =
    state === "selected"
      ? dark
        ? "border-brand-400 bg-brand-500/25 ring-2 ring-brand-400"
        : "border-brand-500 bg-brand-50 ring-2 ring-brand-300"
      : state === "correct"
        ? `gs-success-pulse border-emerald-400 ring-2 ring-emerald-400 ${dark ? "bg-emerald-500/20" : "bg-emerald-50"}`
        : state === "incorrect"
          ? `gs-shake border-red-400 ring-2 ring-red-400 ${dark ? "bg-red-500/15" : "bg-red-50"}`
          : state === "dimmed"
            ? "opacity-35"
            : "";

  const badgeClasses =
    state === "selected"
      ? "bg-brand-500 text-white"
      : state === "correct"
        ? "bg-emerald-500 text-white"
        : state === "incorrect"
          ? "bg-red-500 text-white"
          : dark
            ? "bg-white/15 text-white/80"
            : "bg-slate-100 text-slate-500";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ["--gs-card-shadow" as string]: shadowColor,
        ["--gs-tilt" as string]: `${tiltSign * 1.5}deg`,
      }}
      className={`gs-card-tactile flex items-center gap-3 rounded-2xl border font-semibold ${
        compact ? "px-3 py-2 text-sm" : "px-4 py-5 text-base sm:py-6 sm:text-lg"
      } ${base} ${stateClasses}`}
    >
      <span
        className={`flex flex-none items-center justify-center rounded-full font-bold ${
          compact ? "h-5 w-5 text-[10px]" : "h-8 w-8 text-sm"
        } ${badgeClasses}`}
      >
        {state === "correct" ? (
          <Check className={compact ? "h-3 w-3" : "h-4 w-4"} aria-hidden="true" />
        ) : (
          letter
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
    </button>
  );
}
