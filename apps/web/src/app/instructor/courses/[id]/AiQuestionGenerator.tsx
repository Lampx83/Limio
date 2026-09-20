"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";

interface QuestionDraft {
  type: "mcq" | "true_false" | "fill_in";
  prompt: string;
  options: Array<{
    label: string;
    isCorrect: boolean;
    misconceptionHint: string | null;
  }>;
  explanation: string;
  skillCodes: string[];
}

const ERROR_MESSAGES: Record<string, string> = {
  lesson_content_too_short:
    "Bài học này chưa có đủ nội dung chữ để AI tạo câu hỏi. Hãy thêm mô tả bài học hoặc một mục nội dung dạng văn bản/transcript rồi thử lại.",
  openai_not_configured: "Chưa cấu hình AI cho hệ thống. Vui lòng liên hệ quản trị viên.",
  no_api_key: "Chưa cấu hình AI cho hệ thống. Vui lòng liên hệ quản trị viên.",
  rate_limited: "Bạn thao tác hơi nhanh. Vui lòng đợi một chút rồi thử lại.",
  daily_token_cap: "Hôm nay đã dùng hết hạn mức AI. Vui lòng thử lại vào ngày mai.",
  global_token_cap: "Hệ thống đã đạt giới hạn AI trong ngày. Vui lòng thử lại vào ngày mai.",
  no_token_budget: "Bạn đã dùng hết token AI của tháng này. Có thể mua thêm ở trang Token AI.",
  forbidden: "Bạn không có quyền tạo câu hỏi cho bài học này.",
  unauthorized: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  openai_error: "AI đang gặp sự cố. Vui lòng thử lại sau ít phút.",
  json_parse_failed:
    "AI không tạo được câu hỏi hợp lệ từ nội dung hiện có. Hãy bổ sung thêm nội dung bài học hoặc thử lại.",
  validation_failed: "Yêu cầu chưa hợp lệ. Hãy kiểm tra số câu (1–10) rồi thử lại.",
};

const NOT_ENOUGH_CONTENT =
  "Nội dung bài học chưa đủ để AI tạo câu hỏi. Hãy bổ sung mô tả hoặc nội dung văn bản cho bài học rồi thử lại.";

function friendlyError(code: string | undefined, message?: string): string {
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code]!;
  if (message) return message;
  return "Không tạo được câu hỏi. Vui lòng thử lại.";
}

export default function AiQuestionGenerator({
  quizId,
  lessonId,
  nextOrderIndex,
  open: openProp,
  onOpenChange,
}: {
  quizId: string;
  lessonId: string;
  nextOrderIndex: number;
  /** Điều khiển từ ngoài (trang soạn quiz đặt panel vào vùng giữa); bỏ trống = tự quản lý. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (v: boolean) => {
    setOpenState(v);
    onOpenChange?.(v);
  };
  const [count, setCount] = useState(3);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [generating, setGenerating] = useState(false);
  const [drafts, setDrafts] = useState<QuestionDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState<number | null>(null);
  const [imported, setImported] = useState<Set<number>>(new Set());

  async function generate() {
    setGenerating(true);
    setError(null);
    setDrafts([]);
    setImported(new Set());
    const res = await fetch(apiUrl("/api/ai/generate-questions"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId, count, difficulty }),
    });
    setGenerating(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(friendlyError(d.error, d.message));
      return;
    }
    const d = await res.json();
    const list: QuestionDraft[] = d.drafts ?? [];
    setDrafts(list);
    if (list.length === 0) setError(NOT_ENOUGH_CONTENT);
  }

  async function importDraft(idx: number) {
    const d = drafts[idx];
    if (!d || imported.has(idx)) return;
    setImporting(idx);
    setError(null);
    const payload = {
      type: d.type,
      prompt: d.prompt,
      points: 1,
      explanation: d.explanation || undefined,
      options: d.options.map((o) => ({
        label: o.label,
        isCorrect: o.isCorrect,
      })),
    };
    const res = await fetch(apiUrl(`/api/quizzes/${quizId}/questions`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setImporting(null);
    if (res.ok) {
      setImported((prev) => new Set(prev).add(idx));
      router.refresh();
    } else {
      const dt = await res.json().catch(() => ({}));
      setError("Không thêm được câu hỏi này vào quiz. Vui lòng thử lại.");
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-sm inline-flex items-center justify-center gap-2 rounded-lg border border-brand-200 bg-brand-soft px-3 py-1.5 font-medium text-brand-700 transition-colors hover:bg-brand-100"
      >
        Tạo câu hỏi bằng AI
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-brand-200 bg-brand-soft p-3 text-xs">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-brand-700">Tạo câu hỏi bằng AI</p>
        <button
          onClick={() => setOpen(false)}
          className="text-faint hover:text-[rgb(var(--text))]"
          aria-label="Đóng"
        >
          ✕
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-faint">Số câu</span>
          <input
            type="number"
            min={1}
            max={10}
            value={count}
            onChange={(e) => setCount(Number(e.target.value) || 3)}
            className="input ml-2 w-16"
          />
        </label>
        <label className="block">
          <span className="text-faint">Độ khó</span>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as "easy" | "medium" | "hard")}
            className="select ml-2 w-28"
          >
            <option value="easy">Dễ</option>
            <option value="medium">Trung bình</option>
            <option value="hard">Khó</option>
          </select>
        </label>
        <button
          onClick={generate}
          disabled={generating}
          className="btn-sm inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
        >
          {generating ? "Đang tạo…" : "Tạo câu hỏi"}
        </button>
      </div>

      {error && (
        <p role="alert" className="banner-warning mt-2 flex items-start gap-2">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      )}

      {drafts.length > 0 && (
        <ul className="mt-3 space-y-2">
          {drafts.map((d, i) => (
            <li
              key={i}
              className="rounded-lg border border-token bg-[rgb(var(--surface))] p-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-faint">
                  <span className="chip mr-1">{d.type}</span>
                  <span>{d.options.length} đáp án</span>
                  {d.skillCodes.length > 0 && (
                    <> · chủ đề: {d.skillCodes.join(", ")}</>
                  )}
                </p>
                <button
                  onClick={() => importDraft(i)}
                  disabled={importing === i || imported.has(i)}
                  className={`btn-sm shrink-0 inline-flex items-center justify-center gap-2 rounded-lg px-2.5 py-1 font-medium transition-colors disabled:opacity-50 ${
                    imported.has(i)
                      ? "bg-success-50 text-success-700"
                      : "bg-brand-600 text-white hover:bg-brand-700"
                  }`}
                >
                  {imported.has(i) ? "✓ Đã thêm vào quiz" : importing === i ? "…" : "Thêm vào quiz"}
                </button>
              </div>
              <p className="mt-2 whitespace-pre-wrap font-medium">{d.prompt}</p>
              <ul className="mt-2 space-y-0.5">
                {d.options.map((o, oi) => (
                  <li key={oi} className="flex items-start gap-1.5">
                    <span
                      className={
                        o.isCorrect ? "text-success-600" : "text-faint"
                      }
                    >
                      {o.isCorrect ? "✓" : "·"}
                    </span>
                    <span className="flex-1">{o.label}</span>
                    {o.misconceptionHint && (
                      <span className="italic text-accent-700">
                        ↳ {o.misconceptionHint}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {d.explanation && (
                <p className="mt-2 italic text-faint">
                  Giải thích: {d.explanation}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
