"use client";

import { ArrowLeft } from "lucide-react";

/**
 * Visual type picker shown when instructor clicks "+ Thêm câu hỏi". Each card
 * has a mini-preview of how the question type renders so the instructor can
 * spot the right one at a glance — much friendlier than the previous
 * <select> dropdown that just listed labels.
 *
 * Only types actually supported by the backend grader appear here (see
 * QuestionType union in AddQuestionForm). "MCQ chọn nhiều" and "MCQ chọn 1"
 * are the same DB type — instructor controls it via how many options are
 * marked correct in the form below.
 */

export type QuestionType =
  | "mcq"
  | "true_false"
  | "fill_in"
  | "ordering"
  | "matching"
  | "numerical"
  | "essay"
  | "short_answer"
  | "drag_drop_fill";

interface TypeCard {
  type: QuestionType;
  title: string;
  preview: React.ReactNode;
}

// Reusable preview building blocks — kept tiny + visual so the cards convey
// shape without taking up too much room.
function PreviewBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-lg border border-token bg-white px-3 py-2.5 text-xs text-slate-700">
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

const TYPE_CARDS: TypeCard[] = [
  {
    type: "mcq",
    title: "Trắc nghiệm",
    preview: (
      <PreviewBox>
        <div className="text-faint">Nội dung câu hỏi…</div>
        <div className="mt-1.5 space-y-1">
          <Bullet letter="A" text="Đáp án A" />
          <Bullet letter="B" text="Đáp án B" active />
          <Bullet letter="C" text="Đáp án C" />
        </div>
      </PreviewBox>
    ),
  },
  {
    type: "true_false",
    title: "Đúng / Sai",
    preview: (
      <PreviewBox>
        <div className="text-faint">Nội dung câu hỏi…</div>
        <div className="mt-1.5 space-y-1">
          <Bullet letter="A" text="Đúng" />
          <Bullet letter="B" text="Sai" active />
        </div>
      </PreviewBox>
    ),
  },
  {
    type: "fill_in",
    title: "Điền khuyết",
    preview: (
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
  },
  {
    type: "numerical",
    title: "Đáp án dạng số",
    preview: (
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
  },
  {
    type: "ordering",
    title: "Sắp xếp thứ tự",
    preview: (
      <PreviewBox>
        <div className="text-faint">Sắp xếp các bước theo đúng thứ tự:</div>
        <div className="mt-1.5 space-y-0.5">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="flex items-center gap-1.5 rounded border border-token px-2 py-0.5"
            >
              <span className="font-mono text-[10px] font-bold text-success-700">
                {n}.
              </span>
              <span className="text-slate-600">Bước {n}</span>
            </div>
          ))}
        </div>
      </PreviewBox>
    ),
  },
  {
    type: "matching",
    title: "Ghép cặp",
    preview: (
      <PreviewBox>
        <div className="space-y-1">
          {[
            ["A", "D"],
            ["B", "E"],
            ["C", "F"],
          ].map(([l, r]) => (
            <div key={l} className="flex items-center gap-1.5">
              <span className="flex-1 rounded border border-token px-2 py-0.5 text-center">
                {l}
              </span>
              <span className="text-faint">→</span>
              <span className="flex-1 rounded border border-token px-2 py-0.5 text-center">
                {r}
              </span>
            </div>
          ))}
        </div>
      </PreviewBox>
    ),
  },
  {
    type: "short_answer",
    title: "Trả lời ngắn",
    preview: (
      <PreviewBox>
        <div className="text-faint">Thủ đô của Việt Nam?</div>
        <div className="mt-1.5 rounded border border-success-500 bg-success-50 px-2 py-1 font-medium text-success-700">
          Hà Nội
        </div>
      </PreviewBox>
    ),
  },
  {
    type: "essay",
    title: "Tự luận",
    preview: (
      <PreviewBox>
        <div className="text-faint">Nội dung câu hỏi…</div>
        <div className="mt-1.5 h-14 rounded border border-dashed border-token bg-slate-50" />
        <div className="mt-1 text-[10px] text-faint">Giảng viên chấm tay</div>
      </PreviewBox>
    ),
  },
  {
    type: "drag_drop_fill",
    title: "Kéo thả từ/câu",
    preview: (
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
            <span
              key={t}
              className="rounded border border-token bg-white px-1.5 py-0.5 text-[10px] shadow-sm"
            >
              {t}
            </span>
          ))}
        </div>
      </PreviewBox>
    ),
  },
];

export default function QuestionTypePicker({
  onPick,
  onCancel,
}: {
  onPick: (type: QuestionType) => void;
  onCancel: () => void;
}) {
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
        {TYPE_CARDS.map((c) => (
          <button
            key={c.type}
            type="button"
            onClick={() => onPick(c.type)}
            className="group cursor-pointer rounded-xl border border-token bg-[rgb(var(--surface))] p-3 text-left transition-all hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-md"
          >
            <div className="text-sm font-semibold text-slate-900 group-hover:text-brand-700">
              {c.title}
            </div>
            {c.preview}
          </button>
        ))}
      </div>
    </div>
  );
}
