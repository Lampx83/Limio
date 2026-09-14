"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
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
  attemptPolicy: "single" | "multi";
  gradingMode: "auto" | "manual" | "hybrid";
  proctoringLevel: "none" | "basic" | "strict";
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showResultsAfterSubmit: boolean;
  purpose: "assessment" | "field_test";
  // A6.1/A6.6 — Bất biến sau khi tạo (đổi kind = tạo Exam mới), nên chỉ hiện
  // ô chọn ở mode="create". Optional vì initial của mode="edit" (page.tsx cũ
  // trước khi có oral) có thể chưa truyền.
  kind?: "written" | "oral";
  answerMode?: "text" | "voice";
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
    kind: initial.kind ?? "written",
    answerMode: initial.answerMode ?? "text",
  });
  const [status, setStatus] = useState<"idle" | "saving" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

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
      attemptPolicy: v.attemptPolicy,
      gradingMode: v.gradingMode,
      proctoringLevel: v.proctoringLevel,
      shuffleQuestions: v.shuffleQuestions,
      shuffleOptions: v.shuffleOptions,
      showResultsAfterSubmit: v.showResultsAfterSubmit,
      purpose: v.purpose,
    };
    // Bất biến sau khi tạo — UpdateExamInput không nhận 2 field này, nên chỉ
    // gửi lúc create.
    if (mode === "create") {
      body.kind = v.kind;
      body.answerMode = v.kind === "oral" ? v.answerMode : undefined;
    }
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
    // Đưa thẳng vào tab tương ứng (Nội dung với thi viết, Tài liệu với vấn
    // đáp) thay vì để GV tự đoán bước tiếp theo là gì — "Lưu" không còn là
    // điểm dừng, mà là bước chuyển sang nhập nội dung.
    const nextTab = v.kind === "oral" ? "materials" : "content";
    if (mode === "create") {
      // replace — quay lại không nên rơi về form tạo đề đã submit rồi.
      router.replace(
        `/instructor/courses/${courseId}/exams/${data.examId}?created=1&tab=${nextTab}`,
      );
    } else {
      router.push(`/instructor/courses/${courseId}/exams/${examId}?tab=${nextTab}`);
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

      {mode === "create" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Loại đề"
            value={v.kind ?? "written"}
            options={[
              { value: "written", label: "Thi viết — câu hỏi trắc nghiệm/tự luận" },
              { value: "oral", label: "Vấn đáp AI — hỏi-đáp trực tiếp với AI giám khảo" },
            ]}
            onChange={(s) => setV({ ...v, kind: s as "written" | "oral" })}
          />
          {v.kind === "oral" && (
            <SelectField
              label="Trả lời bằng"
              value={v.answerMode ?? "text"}
              options={[
                { value: "text", label: "Nhắn tin" },
                { value: "voice", label: "Giọng nói" },
              ]}
              onChange={(s) => setV({ ...v, answerMode: s as "text" | "voice" })}
            />
          )}
        </div>
      )}
      {mode === "create" && v.kind === "oral" && (
        <p className="banner-info px-3 py-2 text-caption">
          Vấn đáp AI không có ngân hàng câu hỏi — sau khi tạo, bạn sẽ nộp tài
          liệu (đề cương, danh sách chủ đề…) ở tab "Tài liệu" để AI dựa vào đó
          hỏi sinh viên. Bài thi luôn bắt buộc toàn màn hình; điểm do AI gợi ý
          và giảng viên duyệt/sửa thủ công, không tự động chấm. Loại đề và
          cách trả lời không đổi được sau khi tạo.
        </p>
      )}

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

      {/* Thời lượng KHÔNG còn ở đây: nó thuộc buổi thi, không thuộc gói đề.
          Cùng một gói chạy 15 phút ở lớp này và 30 phút ở lớp kia là chuyện
          bình thường, nên con số đó được chọn lúc mở buổi thi (Tổ chức thi →
          Link thi nhanh). Exam.durationMin chỉ còn là giá trị mặc định gợi ý. */}
      <div>
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

      <div>
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="flex items-center gap-1 text-sm font-medium text-faint hover:text-default"
        >
          {advancedOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          Nâng cao — mục đích, chấm điểm, giám thị, trộn đề…
        </button>

        {advancedOpen && (
          <div className="mt-3 space-y-5 rounded border border-default bg-slate-50 p-4">
            <div>
              <SelectField
                label="Mục đích"
                value={v.purpose}
                disabled={isLocked("purpose")}
                options={[
                  { value: "assessment", label: "Đề thi thật — đo học sinh" },
                  { value: "field_test", label: "Đề thử nghiệm — đo câu hỏi" },
                ]}
                onChange={(s) => {
                  const purpose = s as InitialValues["purpose"];
                  // Chuyển sang đề thử nghiệm thì tắt luôn hiện đáp án: để bật là
                  // đốt câu hỏi, lớp sau không thử nghiệm sạch được nữa. GV vẫn bật
                  // lại được ngay bên dưới nếu cố ý.
                  setV({
                    ...v,
                    purpose,
                    showResultsAfterSubmit:
                      purpose === "field_test" ? false : v.showResultsAfterSubmit,
                  });
                }}
              />
              {v.purpose === "field_test" && (
                <p className="mt-1 banner-warning px-3 py-2 text-caption">
                  Đề thử nghiệm được phép chở câu hỏi chưa kết nạp vào ngân hàng, và
                  mặc định <strong>không hiện đáp án</strong> sau khi nộp. Điểm của đề này
                  không nên dùng làm điểm chính thức.
                </p>
              )}
            </div>

            {v.kind === "oral" ? (
              // Vấn đáp AI: không có ExamQuestion nên trộn câu hỏi/đáp án vô
              // nghĩa; chấm điểm luôn là AI gợi ý + GV duyệt tay (xem tab
              // Chấm điểm), không theo gradingMode; giám thị luôn bắt buộc
              // fullscreen (xem banner ở trên) nên không cần chọn mức độ.
              <p className="banner-info px-3 py-2 text-caption">
                Chấm điểm, giám thị và trộn đề không áp dụng cho vấn đáp AI —
                xem giải thích ở banner phía trên.
              </p>
            ) : (
              <>
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

                <fieldset className="space-y-2 rounded border border-default bg-white p-3">
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
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          Lỗi: {error}
        </div>
      )}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={status === "saving"}
          className="rounded bg-brand-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {status === "saving"
            ? "Đang lưu…"
            : mode === "create"
              ? "Lưu và tiếp tục"
              : "Tiếp tục"}
        </button>
      </div>
    </form>
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
