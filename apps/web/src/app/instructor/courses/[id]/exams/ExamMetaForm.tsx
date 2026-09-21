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

// A6.3 (UI) — mẫu gợi ý khi tạo đề vấn đáp mới, điền sẵn vào ô hướng dẫn cho
// AI giám khảo (GV sửa/xoá tuỳ ý — đây chỉ là điểm khởi đầu, không phải giá
// trị mặc định ẩn ở backend). Nhắm đúng vấn đề đã gặp: AI hỏi giống chatbot
// chung chung hơn giám khảo thật, để SV dẫn dắt, hỏi nhảy lung tung chủ đề.
// Lưu ý: lượt ĐẦU TIÊN hệ thống luôn tự chào và giới thiệu (xem examinerChat.ts),
// nên mẫu này không được bảo AI "đừng trò chuyện" — sẽ mâu thuẫn với lời chào đó.
const DEFAULT_EXAMINER_INSTRUCTIONS = `Giữ vai trò giám khảo chuyên nghiệp: lịch sự, bình tĩnh, giọng thân thiện vừa đủ để sinh viên bớt căng thẳng, nhưng không trò chuyện xã giao dài dòng. Không khen "tốt lắm", "chính xác" hay nhận xét đúng/sai giữa buổi.

Luôn là người dẫn dắt cuộc hỏi-đáp: nếu sinh viên cố lái sang chủ đề khác, hỏi ngược lại giám khảo, hoặc trả lời lan man né tránh, hãy nhắc lại đúng trọng tâm câu hỏi thay vì đi theo hướng sinh viên đưa ra.

Hỏi tuần tự theo đúng thứ tự tài liệu/chủ đề đã nộp: khai thác hết một chủ đề (2-3 câu đào sâu) rồi mới chuyển sang chủ đề tiếp theo, không nhảy qua lại giữa các chủ đề.

Nếu sinh viên trả lời sai hoặc thiếu, không sửa hộ hay gợi ý đáp án — hỏi thêm 1 câu làm rõ, rồi chuyển tiếp nếu sinh viên vẫn không trả lời được.`;

// Trần của ô hướng dẫn — phải khớp CreateExamInput/UpdateExamInput.examinerInstructions
// (packages/core-lms/src/exam/exams.ts). Hiện ra để GV không phải đoán, và bị chặn
// từ lúc gõ thay vì chỉ biết khi lưu bị từ chối.
const EXAMINER_INSTRUCTIONS_MAX = 5_000;

interface InitialValues {
  title: string;
  description: string;
  durationMin: number;
  openAt: string; // datetime-local ISO without zone
  closeAt: string;
  attemptPolicy: "single" | "multi";
  /** Chỉ có ý nghĩa khi attemptPolicy="multi" (vấn đáp AI): số lượt tối đa mỗi sinh viên, 2–10. */
  maxAttempts?: number;
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
  /** A6.3/A6.6 — chỉ có ý nghĩa khi kind=oral, bất biến sau khi tạo. */
  language?: "vi" | "en" | "zh";
  /** A6.3 (UI) — chèn vào system prompt AI giám khảo mỗi lượt hỏi. */
  examinerInstructions?: string;
  /** A6.7 — pha khởi động (chào + làm quen) tách riêng trước câu kiến thức đầu tiên. */
  oralWarmup?: boolean;
  /** A6.8 — exam: AI trung lập trong buổi (bài thi); coaching: nhận xét ngắn sau mỗi câu (bài luyện). */
  oralFeedbackMode?: "exam" | "coaching";
  /** A6.8 — lời kết có thêm "Nhìn lại buổi vấn đáp" (không điểm số). */
  oralClosingSummary?: boolean;
}

interface Props {
  mode: "create" | "edit";
  /** null = đề độc lập, không gắn khoá học nào. */
  courseId: string | null;
  examId?: string;
  initial: InitialValues;
  /** When true, lock fields that publish-time validation forbids editing. */
  lockedFields?: ReadonlyArray<keyof InitialValues>;
  /**
   * mode="create" only — loại đề do ĐIỂM VÀO quyết định (menu "Đề thi" vs
   * "Vấn đáp AI"), không còn cho GV chọn giữa chừng trong form: hai luồng
   * giờ tách hẳn thành 2 menu riêng, lẫn lộn ở đây chỉ gây nhầm "đây cũng là
   * 1 dạng đề thi bình thường".
   */
  fixedKind?: "written" | "oral";
  /** mode="edit" only — tên khoá học đề đang gắn (null = đề độc lập), hiện dạng chỉ đọc. */
  courseLabel?: string | null;
}

export default function ExamMetaForm({
  mode,
  courseId,
  examId,
  initial,
  lockedFields,
  courseLabel,
  fixedKind,
}: Props) {
  const router = useRouter();
  const resolvedKind = mode === "create" ? (fixedKind ?? "written") : (initial.kind ?? "written");
  const [v, setV] = useState<InitialValues>({
    ...initial,
    description: plainToRichHtml(initial.description),
    kind: resolvedKind,
    answerMode: initial.answerMode ?? "text",
    language: initial.language ?? "vi",
    // Chỉ điền mẫu gợi ý lúc TẠO MỚI — mode="edit" phải hiện đúng những gì đề
    // đang có (kể cả rỗng), không tự chèn mẫu vào để khỏi gây hiểu lầm là GV
    // đã từng lưu nội dung này.
    examinerInstructions:
      initial.examinerInstructions ??
      (mode === "create" && resolvedKind === "oral" ? DEFAULT_EXAMINER_INSTRUCTIONS : ""),
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
      // Chỉ gửi khi thật sự dùng (vấn đáp + nhiều lượt) — khoá bởi lượt thi thì server từ chối trường này.
      ...(v.kind === "oral" && v.attemptPolicy === "multi" && !isLocked("maxAttempts")
        ? { maxAttempts: Math.min(10, Math.max(2, Math.round(v.maxAttempts ?? 3))) }
        : {}),
      gradingMode: v.gradingMode,
      proctoringLevel: v.proctoringLevel,
      shuffleQuestions: v.shuffleQuestions,
      shuffleOptions: v.shuffleOptions,
      showResultsAfterSubmit: v.showResultsAfterSubmit,
      purpose: v.purpose,
    };
    if (v.kind === "oral") {
      body.examinerInstructions = v.examinerInstructions || undefined;
      // Khoá khi đã có lượt thi (đổi giữa chừng làm các lượt thi không cùng điều kiện).
      if (!isLocked("oralWarmup")) body.oralWarmup = v.oralWarmup ?? false;
      if (!isLocked("oralFeedbackMode")) body.oralFeedbackMode = v.oralFeedbackMode ?? "exam";
      if (!isLocked("oralClosingSummary")) body.oralClosingSummary = v.oralClosingSummary ?? false;
      // Sửa được cả lúc tạo lẫn sau đó (khoá khi đã có lượt thi — gửi trường bị khoá sẽ bị server từ chối).
      if (!isLocked("answerMode")) body.answerMode = v.answerMode;
      if (!isLocked("language")) body.language = v.language;
    }
    // Loại đề bất biến sau khi tạo (đổi kind = tạo Exam mới), nên chỉ gửi lúc create.
    if (mode === "create") {
      body.kind = v.kind;
    }
    const url =
      mode === "create"
        ? courseId
          ? `/api/courses/${courseId}/exams`
          : "/api/exams"
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
    const courseSegment = courseId ?? "none";
    if (mode === "create") {
      // replace — quay lại không nên rơi về form tạo đề đã submit rồi.
      router.replace(
        `/instructor/courses/${courseSegment}/exams/${data.examId}?created=1&tab=${nextTab}`,
      );
    } else {
      router.push(`/instructor/courses/${courseSegment}/exams/${examId}?tab=${nextTab}`);
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

      {v.kind === "oral" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Trả lời bằng"
            value={v.answerMode ?? "text"}
            disabled={isLocked("answerMode")}
            options={[
              { value: "text", label: "Gõ văn bản" },
              { value: "voice", label: "Giọng nói" },
            ]}
            onChange={(s) => setV({ ...v, answerMode: s as "text" | "voice" })}
          />
          <SelectField
            label="Ngôn ngữ hỏi-đáp"
            value={v.language ?? "vi"}
            disabled={isLocked("language")}
            options={[
              { value: "vi", label: "Tiếng Việt" },
              { value: "en", label: "English" },
              { value: "zh", label: "Tiếng Trung" },
            ]}
            onChange={(s) => setV({ ...v, language: s as "vi" | "en" | "zh" })}
          />
        </div>
      )}
      {mode === "edit" && courseLabel !== undefined && (
        <p className="text-sm text-faint">
          Khoá học: <span className="font-medium text-[rgb(var(--text))]">{courseLabel ?? "Không gắn khoá học (đề độc lập)"}</span>
          {" "}— không đổi được sau khi tạo (ca thi và bố cục đã gắn với khoá này).
        </p>
      )}

      {v.kind === "oral" && (
        <div>
          <label className="block text-sm font-medium">
            Hướng dẫn phong cách hỏi cho AI giám khảo (tuỳ chọn)
          </label>
          <p className="mt-0.5 text-caption text-faint">
            Chèn thêm vào chỉ dẫn của AI mỗi lượt hỏi — không hiện cho sinh
            viên. Đã điền sẵn 1 mẫu gợi ý, bạn sửa/xoá tuỳ ý — để trống thì
            AI chỉ theo các nguyên tắc mặc định của hệ thống: hỏi từng câu, đào
            sâu theo câu trả lời trước, không gợi ý đáp án, đúng ngôn ngữ đề, và
            ở lượt đầu tiên luôn tự chào và giới thiệu ngắn.
          </p>
          <textarea
            rows={7}
            maxLength={EXAMINER_INSTRUCTIONS_MAX}
            value={v.examinerInstructions ?? ""}
            onChange={(e) => setV({ ...v, examinerInstructions: e.target.value })}
            className="mt-1 w-full rounded border border-default px-3 py-2 text-sm"
          />
          <p
            className={`mt-1 text-right text-caption ${
              (v.examinerInstructions ?? "").length >= EXAMINER_INSTRUCTIONS_MAX * 0.9
                ? "font-medium text-amber-700"
                : "text-faint"
            }`}
            aria-live="polite"
          >
            {(v.examinerInstructions ?? "").length.toLocaleString("vi-VN")} /{" "}
            {EXAMINER_INSTRUCTIONS_MAX.toLocaleString("vi-VN")} ký tự
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium" htmlFor="description">
          {v.kind === "oral" ? "Mô tả — hiện cho học viên trong phòng vấn đáp" : "Mô tả (tuỳ chọn)"}
        </label>
        {v.kind === "oral" && (
          <p className="mt-0.5 text-caption text-faint">
            Hiện ở khung bên phải phòng thi, cạnh AI giám khảo — học viên đọc
            được, cho phép chèn ảnh. Bỏ trống thì hiện gợi ý mặc định.
          </p>
        )}
        <div className="mt-1">
          <RichTextEditor
            value={v.description}
            onChange={(html) => setV({ ...v, description: html })}
          />
        </div>
      </div>

      {/* Thời lượng thật thuộc buổi thi, không thuộc gói đề: cùng một gói chạy
          15 phút ở lớp này và 30 phút ở lớp kia là chuyện bình thường, nên con
          số được chọn lúc mở buổi (Tổ chức thi → Link thi nhanh; với vấn đáp là
          nút "Mở buổi vấn đáp"). Exam.durationMin chỉ là giá trị điền sẵn — nên
          đề viết không hỏi ở đây; đề vấn đáp thì HIỆN nó ngay bên dưới, vì nút
          "Mở buổi vấn đáp" lấy đúng số này làm mặc định và trước đây nó nằm ẩn
          với giá trị 60 do form tạo mới điền ngầm. */}
      {v.kind === "oral" && (
        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={v.oralWarmup ?? false}
            disabled={isLocked("oralWarmup")}
            onChange={(e) => setV({ ...v, oralWarmup: e.target.checked })}
          />
          <span>
            <span className="font-medium">Có pha khởi động trước khi hỏi</span>
            <span className="mt-0.5 block text-caption text-faint">
              Lượt đầu AI chỉ chào, giới thiệu và hỏi một câu làm quen (chưa hỏi kiến thức); câu kiến
              thức đầu tiên đến ở lượt sau, kèm chủ đề của sinh viên. Pha này vẫn tính vào thời lượng.
              Tắt: AI chào rồi hỏi luôn trong cùng lượt. Nếu bật, đừng tự dặn lời chào/khởi động lần nữa
              trong ô hướng dẫn ở trên.
            </span>
          </span>
        </label>
      )}

      {v.kind === "oral" && (
        <div className="space-y-3">
          <SelectField
            label="Cách AI phản hồi trong buổi"
            value={v.oralFeedbackMode ?? "exam"}
            disabled={isLocked("oralFeedbackMode")}
            options={[
              { value: "exam", label: "Thi — trung lập: chỉ ghi nhận rồi hỏi tiếp, không khen/chê" },
              { value: "coaching", label: "Luyện — sau mỗi câu có 1 nhận xét ngắn, cụ thể" },
            ]}
            onChange={(s) => setV({ ...v, oralFeedbackMode: s as "exam" | "coaching" })}
          />
          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={v.oralClosingSummary ?? false}
              disabled={isLocked("oralClosingSummary")}
              onChange={(e) => setV({ ...v, oralClosingSummary: e.target.checked })}
            />
            <span>
              <span className="font-medium">Có &quot;Nhìn lại buổi vấn đáp&quot; ở lời kết</span>
              <span className="mt-0.5 block text-caption text-faint">
                Cuối buổi AI nêu vài điểm làm tốt và vài điểm nên cải thiện dựa trên chính câu trả lời của sinh
                viên — <strong>không có điểm số</strong>, không nêu đáp án đầy đủ. Bật khi muốn sinh viên nhận
                được phản hồi mà vẫn giữ buổi thi công bằng.
              </span>
            </span>
          </label>
        </div>
      )}

      {v.kind === "oral" && (
        <div>
          <label className="block text-sm font-medium" htmlFor="durationMin">
            Thời lượng mặc định mỗi lượt (phút)
          </label>
          <input
            id="durationMin"
            type="number"
            min={1}
            max={24 * 60}
            value={v.durationMin}
            disabled={isLocked("durationMin")}
            onChange={(e) => setV({ ...v, durationMin: Number(e.target.value) })}
            className="mt-1 w-full rounded border border-default px-3 py-2 text-sm disabled:bg-slate-50 sm:w-40"
          />
          <p className="mt-1 text-caption text-faint">
            Đây là số phút điền sẵn khi bạn bấm &quot;Mở buổi vấn đáp&quot; — mỗi buổi vẫn đổi
            được lại lúc mở. Nếu phần mô tả bên dưới có ghi số phút, nhớ cho khớp.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField
          label={v.kind === "oral" ? "Số lượt vấn đáp" : "Số lượt thi"}
          value={v.attemptPolicy}
          disabled={isLocked("attemptPolicy")}
          // Nhiều lượt chỉ có cho vấn đáp AI; thi viết luôn 1 lượt (server cũng chặn).
          options={
            v.kind === "oral"
              ? [
                  { value: "single", label: "1 lượt duy nhất" },
                  { value: "multi", label: "Nhiều lượt (sinh viên tự bấm Thi lại)" },
                ]
              : [{ value: "single", label: "1 lượt duy nhất" }]
          }
          onChange={(s) => setV({ ...v, attemptPolicy: s as "single" | "multi" })}
        />
        {v.kind === "oral" && v.attemptPolicy === "multi" && (
          <div>
            <label className="block text-sm font-medium" htmlFor="maxAttempts">
              Số lượt tối đa mỗi sinh viên
            </label>
            <input
              id="maxAttempts"
              type="number"
              min={2}
              max={10}
              value={v.maxAttempts ?? 3}
              disabled={isLocked("maxAttempts")}
              onChange={(e) => setV({ ...v, maxAttempts: Number(e.target.value) })}
              className="mt-1 w-full rounded border border-default px-3 py-2 text-sm disabled:bg-slate-50"
            />
            <p className="mt-1 text-caption text-faint">
              Điểm tính theo lượt cao nhất. Mỗi lượt vấn đáp dùng token AI riêng.
            </p>
          </div>
        )}
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
