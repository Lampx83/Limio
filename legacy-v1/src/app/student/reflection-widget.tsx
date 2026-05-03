"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface ReflectionRow {
  id: number;
  prompt: string;
  content: string;
  created_at: string;
}

const PROMPTS = [
  "Tuần này, điều gì làm bạn HỌC ĐƯỢC nhiều nhất? Bằng cách nào?",
  "Có chiến lược học nào KHÔNG hiệu quả với bạn? Bạn sẽ thay bằng gì?",
  "Một khái niệm bạn vẫn còn thấy MƠ HỒ là gì? Bạn sẽ làm gì để hiểu rõ?",
  "Bạn đã đạt mục tiêu mình đặt ra chưa? Lý do?",
  "Phần nào của khoá học bạn đang thấy NGẠI/TRÁNH? Tại sao?",
];

export default function ReflectionWidget({
  reflections,
}: {
  reflections: ReflectionRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [promptIdx, setPromptIdx] = useState(0);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function save() {
    if (content.trim().length < 10) return;
    setSubmitting(true);
    try {
      await fetch("/api/reflections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: PROMPTS[promptIdx], content }),
      });
      setContent("");
      setOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div>
          <h3 className="font-semibold text-base">📝 Nhật ký suy ngẫm</h3>
          <p className="text-xs text-slate-500">
            Phản hồi với chính mình về quá trình học
          </p>
        </div>
        {!open && (
          <button onClick={() => setOpen(true)} className="btn-primary text-xs py-1.5 px-3">
            + Viết suy ngẫm
          </button>
        )}
      </div>

      {open && (
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 mb-3 space-y-2">
          <label className="label text-xs">Chọn câu hỏi gợi mở</label>
          <select
            className="input text-sm"
            value={promptIdx}
            onChange={(e) => setPromptIdx(Number(e.target.value))}
          >
            {PROMPTS.map((p, i) => (
              <option key={i} value={i}>
                {p}
              </option>
            ))}
          </select>
          <textarea
            className="input text-sm min-h-[100px]"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Viết suy ngẫm của bạn (≥10 ký tự)..."
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setOpen(false)}
              className="btn-secondary text-xs py-1 px-2"
            >
              Huỷ
            </button>
            <button
              onClick={save}
              disabled={submitting || content.trim().length < 10}
              className="btn-primary text-xs py-1 px-2"
            >
              {submitting ? "..." : "Lưu"}
            </button>
          </div>
        </div>
      )}

      {reflections.length === 0 ? (
        <p className="text-sm text-slate-500 italic">
          Chưa có suy ngẫm nào. Viết thường xuyên giúp tự điều chỉnh học tập tốt hơn.
        </p>
      ) : (
        <ul className="space-y-2">
          {reflections.slice(0, 3).map((r) => (
            <li
              key={r.id}
              className="p-2 rounded bg-slate-50 dark:bg-slate-800/50"
            >
              <p className="text-xs text-slate-500 italic mb-1">{r.prompt}</p>
              <p className="text-sm">{r.content}</p>
              <p className="text-xs text-slate-400 mt-1">{r.created_at}</p>
            </li>
          ))}
          {reflections.length > 3 && (
            <p className="text-xs text-slate-500">
              ... và {reflections.length - 3} suy ngẫm trước.
            </p>
          )}
        </ul>
      )}
    </div>
  );
}
