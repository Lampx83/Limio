"use client";

import { BookOpen, ClipboardCheck, Wrench, type LucideIcon } from "lucide-react";
import {
  LESSON_TEMPLATE_HINTS,
  LESSON_TEMPLATE_KEYS,
  LESSON_TEMPLATE_LABELS,
  type LessonTemplateKey,
} from "@feedbackme/shared-types";

const ICONS: Record<LessonTemplateKey, LucideIcon> = {
  theory: BookOpen,
  practice: Wrench,
  review: ClipboardCheck,
};

/**
 * Chọn mẫu bài — lựa chọn duy nhất về khung bài giảng viên phải làm. Cách
 * trình bày từng mục do AI tự chọn; muốn đổi thì sửa sau trong trình soạn.
 */
export default function TemplatePicker({
  value,
  onChange,
  disabled,
  compact,
}: {
  value: LessonTemplateKey;
  onChange: (v: LessonTemplateKey) => void;
  disabled?: boolean;
  /** Cột hẹp (màn Dàn ý): xếp dọc, mỗi mẫu một dòng. */
  compact?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Mẫu bài" className={`grid gap-2 ${compact ? "" : "sm:grid-cols-3"}`}>
      {LESSON_TEMPLATE_KEYS.map((k) => {
        const Icon = ICONS[k];
        const on = k === value;
        return (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={`${LESSON_TEMPLATE_LABELS[k]}: ${LESSON_TEMPLATE_HINTS[k]}`}
            disabled={disabled}
            onClick={() => onChange(k)}
            className={`flex rounded-xl border-2 text-left ${
              compact ? "flex-wrap items-baseline gap-x-2 gap-y-0.5 px-3 py-2" : "flex-col items-start gap-1.5 px-3 py-2.5"
            } transition-colors disabled:opacity-60 ${
              on ? "border-brand-600 bg-brand-soft" : "border-token bg-[rgb(var(--surface))] hover:border-brand-300"
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Icon className={`h-4 w-4 ${on ? "text-brand-700" : "text-faint"}`} aria-hidden />
              {LESSON_TEMPLATE_LABELS[k]}
            </span>
            <span className="text-caption text-muted">{LESSON_TEMPLATE_HINTS[k]}</span>
          </button>
        );
      })}
    </div>
  );
}
