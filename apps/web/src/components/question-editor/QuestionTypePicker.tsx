"use client";

import { ArrowLeft } from "lucide-react";
import {
  AI_SUPPORTED_TYPES,
  QUESTION_TYPES,
  TYPE_LABEL,
  type QuestionType,
} from "./types";

/**
 * Đợt 2 — bản DÙNG CHUNG của type picker, tổng quát hoá từ
 * apps/web/src/app/instructor/courses/[id]/QuestionTypePicker.tsx (Quiz-only,
 * chưa bị xoá/thay thế — xem comment ở file đó). Đợt 3-5 sẽ lần lượt đổi
 * Quiz/Ngân hàng/Đề thi sang dùng component này; tới lúc đó nó chưa được
 * import ở đâu cả (chỉ mới build hạ tầng, chưa đổi hành vi nơi nào).
 *
 * Badge "✨ AI" tái dùng đúng pattern + màu (violet-100/violet-700) mà user đã
 * thêm tay vào ActivityPicker.tsx (tile "Văn bản") — xem AI_SUPPORTED_TYPES.
 */

interface TypeCard {
  type: QuestionType;
  preview: React.ReactNode;
}

// Reusable preview building blocks — kept tiny + visual so the cards convey
// shape without taking up too much room.
function PreviewBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 min-w-0 overflow-hidden rounded-lg border border-token bg-white px-3 py-2.5 text-xs text-slate-700">
      {children}
    </div>
  );
}

function Bullet({
  letter,
  active,
  text,
}: {
  letter: string;
  active?: boolean;
  text: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
          active ? "bg-success-500 text-white" : "bg-slate-200 text-slate-500"
        }`}
      >
        {letter}
      </span>
      <span className={active ? "font-medium text-success-700" : "text-slate-600"}>
        {text}
      </span>
    </div>
  );
}

const TYPE_CARDS: Record<QuestionType, React.ReactNode> = {
  mcq: (
    <PreviewBox>
      <div className="text-faint">Nội dung câu hỏi…</div>
      <div className="mt-1.5 space-y-1">
        <Bullet letter="A" text="Đáp án A" />
        <Bullet letter="B" text="Đáp án B" active />
        <Bullet letter="C" text="Đáp án C" />
      </div>
    </PreviewBox>
  ),
  multi: (
    <PreviewBox>
      <div className="text-faint">Nội dung câu hỏi…</div>
      <div className="mt-1.5 space-y-1">
        <Bullet letter="A" text="Đáp án A" active />
        <Bullet letter="B" text="Đáp án B" />
        <Bullet letter="C" text="Đáp án C" active />
      </div>
    </PreviewBox>
  ),
  true_false_notgiven: (
    <PreviewBox>
      <div className="text-faint">Nội dung câu hỏi…</div>
      <div className="mt-1.5 space-y-1">
        <Bullet letter="A" text="Đúng" />
        <Bullet letter="B" text="Sai" active />
      </div>
    </PreviewBox>
  ),
  gap_fill: (
    <PreviewBox>
      <div className="flex flex-wrap items-center gap-1.5">
        <span>Một đội bóng có</span>
        <span className="border-b-2 border-success-500 px-2 font-medium text-success-700">
          11
        </span>
        <span>cầu thủ</span>
      </div>
    </PreviewBox>
  ),
  numerical: (
    <PreviewBox>
      <div className="text-faint">Chu vi hình vuông cạnh 5cm?</div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className="rounded border border-success-500 bg-success-50 px-3 py-0.5 font-mono font-semibold text-success-700">
          20
        </span>
        <span className="text-faint">cm (±0.1)</span>
      </div>
    </PreviewBox>
  ),
  ordering: (
    <PreviewBox>
      <div className="text-faint">Sắp xếp theo thứ tự đúng:</div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex items-center gap-1">
            <div className="flex items-center gap-1 whitespace-nowrap rounded border border-token bg-white px-1.5 py-0.5">
              <span className="font-mono text-[9px] font-bold text-success-700">{n}.</span>
              <span className="text-[10px] text-slate-600">Bước {n}</span>
            </div>
            {n < 3 && (
              <span className="text-[10px] text-faint" aria-hidden>
                →
              </span>
            )}
          </div>
        ))}
      </div>
    </PreviewBox>
  ),
  matching: (
    <PreviewBox>
      <div className="space-y-1">
        {[
          ["A", "D"],
          ["B", "E"],
          ["C", "F"],
        ].map(([l, r]) => (
          <div key={l} className="flex items-center gap-1.5">
            <span className="flex-1 rounded border border-token px-2 py-0.5 text-center">{l}</span>
            <span className="text-faint">→</span>
            <span className="flex-1 rounded border border-token px-2 py-0.5 text-center">{r}</span>
          </div>
        ))}
      </div>
    </PreviewBox>
  ),
  short_answer: (
    <PreviewBox>
      <div className="text-faint">Thủ đô của Việt Nam?</div>
      <div className="mt-1.5 rounded border border-success-500 bg-success-50 px-2 py-1 font-medium text-success-700">
        Hà Nội
      </div>
    </PreviewBox>
  ),
  essay: (
    <PreviewBox>
      <div className="text-faint">Nội dung câu hỏi…</div>
      <div className="mt-1.5 h-14 rounded border border-dashed border-token bg-slate-50" />
      <div className="mt-1 text-[10px] text-faint">Giảng viên chấm tay</div>
    </PreviewBox>
  ),
  drag_drop_fill: (
    <PreviewBox>
      <div className="flex flex-wrap items-center gap-1.5">
        <span>Một đội bóng có</span>
        <span className="inline-flex h-5 min-w-[40px] items-center justify-center rounded border border-dashed border-brand-400 bg-brand-soft px-1 text-[10px] text-brand-700">
          11
        </span>
        <span>cầu thủ</span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {["11", "12", "10"].map((t) => (
          <span key={t} className="rounded border border-token bg-white px-1.5 py-0.5 text-[10px] shadow-sm">
            {t}
          </span>
        ))}
      </div>
    </PreviewBox>
  ),
};

export default function QuestionTypePicker({
  onPick,
  onCancel,
  types = QUESTION_TYPES,
  aiSupported = AI_SUPPORTED_TYPES,
}: {
  onPick: (type: QuestionType) => void;
  onCancel: () => void;
  /** Giới hạn tile hiển thị (mặc định: cả 10 loại). */
  types?: readonly QuestionType[];
  /** Loại nào gắn badge "✨ AI" (mặc định: 5 loại ImportMcqModal hỗ trợ). */
  aiSupported?: ReadonlySet<QuestionType>;
}) {
  const cards: TypeCard[] = types.map((type) => ({ type, preview: TYPE_CARDS[type] }));

  return (
    <div className="space-y-4 rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Quay lại"
          className="flex h-7 w-7 items-center justify-center rounded text-faint hover:bg-slate-100 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h3 className="text-sm font-semibold">
          Chọn loại câu hỏi
          <span className="ml-2 font-normal text-faint">— Thêm câu hỏi mới</span>
        </h3>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <button
            key={c.type}
            type="button"
            onClick={() => onPick(c.type)}
            className="group relative flex cursor-pointer flex-col items-stretch justify-start rounded-xl border border-token bg-[rgb(var(--surface))] p-3 text-left transition-all hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-md"
          >
            {aiSupported.has(c.type) && (
              <span
                className="absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700"
                aria-hidden
              >
                ✨ AI
              </span>
            )}
            <div className="text-sm font-semibold text-slate-900 group-hover:text-brand-700">
              {TYPE_LABEL[c.type]}
            </div>
            {c.preview}
          </button>
        ))}
      </div>
    </div>
  );
}
