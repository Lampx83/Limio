"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { apiUrl } from "@/lib/apiUrl";
import { plainToRichHtml } from "@/lib/richText";

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  ssr: false,
});

interface InitialValues {
  title: string;
  description: string;
  durationMin: number;
  openAt: string; // datetime-local ISO without zone
  closeAt: string;
  passScore: number;
  attemptPolicy: "single" | "multi";
  gradingMode: "auto" | "manual" | "hybrid";
  proctoringLevel: "none" | "basic" | "strict";
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showResultsAfterSubmit: boolean;
}

interface Props {
  mode: "create" | "edit";
  courseId: string;
  examId?: string;
  initial: InitialValues;
  /** When true, lock fields that publish-time validation forbids editing. */
  lockedFields?: ReadonlyArray<keyof InitialValues>;
}

export default function ExamMetaForm({
  mode,
  courseId,
  examId,
  initial,
  lockedFields,
}: Props) {
  const router = useRouter();
  const [v, setV] = useState<InitialValues>({
    ...initial,
    description: plainToRichHtml(initial.description),
  });
  const [status, setStatus] = useState<"idle" | "saving" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const isLocked = (k: keyof InitialValues) => lockedFields?.includes(k) ?? false;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    const body: Record<string, unknown> = {
      title: v.title,
      description: v.description || undefined,
      durationMin: v.durationMin,
      openAt: new Date(v.openAt).toISOString(),
      closeAt: new Date(v.closeAt).toISOString(),
      passScore: v.passScore,
      attemptPolicy: v.attemptPolicy,
      gradingMode: v.gradingMode,
      proctoringLevel: v.proctoringLevel,
      shuffleQuestions: v.shuffleQuestions,
      shuffleOptions: v.shuffleOptions,
      showResultsAfterSubmit: v.showResultsAfterSubmit,
    };
    const url =
      mode === "create"
        ? `/api/courses/${courseId}/exams`
        : `/api/exams/${examId}`;
    const res = await fetch(apiUrl(url), {
      method: mode === "create" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus("error");
      setError(typeof data?.error === "string" ? data.error : "save_failed");
      return;
    }
    setStatus("ok");
    if (mode === "create") {
      router.replace(`/instructor/courses/${courseId}/exams/${data.examId}`);
    } else {
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded border border-default bg-white p-5">
      <div>
        <label className="block text-sm font-medium" htmlFor="title">
          Tiêu đề
        </label>
        <input
          id="title"
          required
          value={v.title}
          onChange={(e) => setV({ ...v, title: e.target.value })}
          className="mt-1 w-full rounded border border-default px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium" htmlFor="description">
          Mô tả (tuỳ chọn)
        </label>
        <div className="mt-1">
          <RichTextEditor
            value={v.description}
            onChange={(html) => setV({ ...v, description: html })}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <NumField
          label="Thời lượng (phút)"
          value={v.durationMin}
          min={1}
          max={24 * 60}
          disabled={isLocked("durationMin")}
          onChange={(n) => setV({ ...v, durationMin: n })}
        />
        <NumField
          label="Điểm đạt (%)"
          value={v.passScore}
          min={0}
          max={100}
          disabled={isLocked("passScore")}
          onChange={(n) => setV({ ...v, passScore: n })}
        />
        <SelectField
          label="Số lượt thi"
          value={v.attemptPolicy}
          disabled={isLocked("attemptPolicy")}
          options={[
            { value: "single", label: "1 lượt duy nhất" },
            { value: "multi", label: "Nhiều lượt (P1)" },
          ]}
          onChange={(s) => setV({ ...v, attemptPolicy: s as "single" | "multi" })}
        />
      </div>

      {/* A5.3 PR2.10 — Thời gian mở/đóng đã chuyển sang Tổ chức thi (ca thi). */}
      {/* Đề thi chỉ giữ nội dung; window logistics thuộc ca thi. */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField
          label="Chấm điểm"
          value={v.gradingMode}
          disabled={isLocked("gradingMode")}
          options={[
            { value: "auto", label: "Tự động" },
            { value: "manual", label: "Tay" },
            { value: "hybrid", label: "Kết hợp" },
          ]}
          onChange={(s) => setV({ ...v, gradingMode: s as InitialValues["gradingMode"] })}
        />
        <SelectField
          label="Giám thị"
          value={v.proctoringLevel}
          disabled={isLocked("proctoringLevel")}
          options={[
            { value: "none", label: "Không" },
            { value: "basic", label: "Cơ bản (fullscreen + tab blur)" },
            { value: "strict", label: "Nghiêm ngặt (P1)" },
          ]}
          onChange={(s) => setV({ ...v, proctoringLevel: s as InitialValues["proctoringLevel"] })}
        />
      </div>

      <fieldset className="space-y-2 rounded border border-default p-3">
        <legend className="px-1 text-xs uppercase tracking-wide text-faint">
          Tuỳ chọn
        </legend>
        <Checkbox
          label="Trộn thứ tự câu hỏi"
          checked={v.shuffleQuestions}
          disabled={isLocked("shuffleQuestions")}
          onChange={(b) => setV({ ...v, shuffleQuestions: b })}
        />
        <Checkbox
          label="Trộn thứ tự đáp án (MCQ / MULTI)"
          checked={v.shuffleOptions}
          disabled={isLocked("shuffleOptions")}
          onChange={(b) => setV({ ...v, shuffleOptions: b })}
        />
        <Checkbox
          label="Hiện chi tiết kết quả cho thí sinh"
          checked={v.showResultsAfterSubmit}
          disabled={isLocked("showResultsAfterSubmit")}
          onChange={(b) => setV({ ...v, showResultsAfterSubmit: b })}
        />
      </fieldset>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          Lỗi: {error}
        </div>
      )}
      {status === "ok" && mode === "edit" && (
        <div className="rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
          Đã lưu.
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={status === "saving"}
          className="rounded bg-amber-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {status === "saving"
            ? "Đang lưu…"
            : mode === "create"
              ? "Tạo bài thi"
              : "Lưu thay đổi"}
        </button>
      </div>
    </form>
  );
}

function NumField({
  label,
  value,
  min,
  max,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded border border-default px-3 py-2 text-sm disabled:bg-slate-50"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (s: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border border-default px-3 py-2 text-sm disabled:bg-slate-50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (b: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
