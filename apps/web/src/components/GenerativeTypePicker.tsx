"use client";

import {
  ClipboardList,
  Eye,
  FileText,
  Hand,
  Lightbulb,
  Network,
  PenTool,
  Presentation,
  type LucideIcon,
} from "lucide-react";
import {
  GENERATIVE_PRESETS,
  GENERATIVE_TYPE_OPTIONS,
  type GenerativeActivityType,
} from "@/lib/generativeActivity";

const ICONS: Record<GenerativeActivityType, LucideIcon> = {
  summarizing: FileText,
  self_explaining: Lightbulb,
  imagining: Eye,
  mapping: Network,
  drawing: PenTool,
  teaching: Presentation,
  enacting: Hand,
};

type Value = GenerativeActivityType | "";

/**
 * Chọn "dạng bài làm" bằng thẻ có biểu tượng + mô tả một dòng, thay cho ô
 * select — giảng viên phổ thông hiểu dạng bài qua việc học viên sẽ làm, không
 * cần biết thuật ngữ. Cùng tinh thần với bộ chọn loại câu hỏi.
 */
export default function GenerativeTypePicker({
  value,
  onChange,
}: {
  value: Value;
  /** Giữ đúng chữ ký của applyPreset ở form tạo để dùng lại logic điền sẵn. */
  onChange: (v: Value) => void;
}) {
  const cards: Array<{
    value: Value;
    label: string;
    description: string;
    submission: string;
    Icon: LucideIcon;
  }> = [
    {
      value: "",
      label: "Bài tập thông thường",
      description: "Giảng viên ra đề và chấm điểm",
      submission: "Nộp: bài viết; file hoặc link tuỳ chọn",
      Icon: ClipboardList,
    },
    ...GENERATIVE_TYPE_OPTIONS.filter(
      (o) => o.available || o.value === value,
    ).map((o) => ({
      value: o.value as Value,
      label: o.label,
      description: GENERATIVE_PRESETS[o.value].description,
      submission: GENERATIVE_PRESETS[o.value].submission,
      Icon: ICONS[o.value],
    })),
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Dạng bài làm"
      className="grid grid-cols-1 gap-2 sm:grid-cols-2"
    >
      {cards.map(({ value: v, label, description, submission, Icon }) => {
        const selected = v === value;
        return (
          <button
            key={v || "plain"}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(v)}
            className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition-all ${
              selected
                ? "border-brand-400 bg-brand-soft ring-1 ring-brand-300"
                : "border-token bg-[rgb(var(--surface))] hover:border-brand-300 hover:bg-brand-soft"
            }`}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                selected ? "bg-brand-100 text-brand-700" : "bg-[rgb(var(--surface-muted))] text-muted"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{label}</span>
              <span className="mt-0.5 block text-xs text-muted">{description}</span>
              <span className="mt-1 block text-xs font-medium text-faint">{submission}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
