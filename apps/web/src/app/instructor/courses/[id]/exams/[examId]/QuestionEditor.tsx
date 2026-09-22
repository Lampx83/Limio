"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { apiUrl } from "@/lib/apiUrl";
import { plainToRichHtml } from "@/lib/richText";
import SkillPicker from "./SkillPicker";
import QuestionTypePicker from "@/components/question-editor/QuestionTypePicker";
import OrderingEditor from "@/components/question-editor/OrderingEditor";
import MatchingEditor from "@/components/question-editor/MatchingEditor";
import NumericalEditor from "@/components/question-editor/NumericalEditor";
import DragDropFillEditor from "@/components/question-editor/DragDropFillEditor";
import {
  type QuestionType as PickedType,
  type OrderingDraft,
  type MatchingDraft,
  type NumericalDraft,
  type DragDropFillDraft,
} from "@/components/question-editor/types";

// Đợt 8 (thống nhất 10 loại Quiz/Bank/Đề thi) — đủ 10 loại canonical đều mở
// được ở picker, dùng 4 editor DÙNG CHUNG (apps/web/src/components/question-editor/)
// cho ordering/matching/numerical/drag_drop_fill. Tên trùng 1-1 với QType nên
// gán thẳng, không cần adapter dịch.
const EXAM_PICKER_TYPES: readonly PickedType[] = [
  "mcq",
  "multi",
  "true_false_notgiven",
  "gap_fill",
  "short_answer",
  "essay",
  "ordering",
  "matching",
  "numerical",
  "drag_drop_fill",
];

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  ssr: false,
});

interface Skill {
  id: string;
  code: string;
  name: string;
}

const TYPE_LABELS: Record<string, string> = {
  mcq: "Trắc nghiệm 1 đáp án (MCQ)",
  multi: "Trắc nghiệm nhiều đáp án (MULTI)",
  true_false_notgiven: "TRUE / FALSE / NOT GIVEN",
  gap_fill: "Điền vào chỗ trống",
  short_answer: "Trả lời ngắn",
  essay: "Tự luận (Essay)",
  ordering: "Sắp xếp thứ tự",
  matching: "Ghép cặp",
  numerical: "Đáp án dạng số",
  drag_drop_fill: "Kéo thả từ/câu",
};

type QType = keyof typeof TYPE_LABELS;

interface State {
  type: QType;
  prompt: string;
  points: number;
  // per-type config; we store union state, only relevant subfields used.
  options: Array<{ id: string; label: string; isCorrect: boolean }>;
  tfng: "true" | "false" | "notgiven";
  blanks: Array<{ id: string; acceptedAnswers: string; matchMode: "exact" | "case_insensitive" }>;
  shortAccepted: string;
  shortMatchMode: "exact" | "case_insensitive";
  essayRubric: string;
  essayMinWords: number;
  // Đợt 8 — 4 loại mới, dùng thẳng shape canonical.
  ordering: OrderingDraft;
  matching: MatchingDraft;
  numerical: NumericalDraft;
  dragDropFill: DragDropFillDraft;
  /** Giải thích đáp án — HS đọc sau khi bài được chấm. Lưu trong config. */
  explanation: string;
  skills: Skill[];
}

interface Props {
  mode: "create" | "edit";
  examId: string;
  passageId: string | null;
  /** Gán câu hỏi mới vào 1 "Phần" (ExamSection) khi đề đã chia nhiều phần. Chỉ áp dụng lúc tạo. */
  sectionId?: string | null;
  questionId?: string;
  initial?: {
    type: string;
    prompt: string;
    points: number;
    config: Record<string, unknown>;
    skills: Skill[];
  };
  onClose: () => void;
}

function defaultState(passageId: string | null): State {
  return {
    type: "mcq",
    prompt: "",
    points: 1,
    options: [
      { id: "a", label: "", isCorrect: true },
      { id: "b", label: "", isCorrect: false },
    ],
    tfng: "true",
    blanks: [{ id: "b1", acceptedAnswers: "", matchMode: "case_insensitive" }],
    shortAccepted: "",
    shortMatchMode: "case_insensitive",
    essayRubric: "",
    essayMinWords: 0,
    ordering: {
      items: [
        { id: "o1", label: "" },
        { id: "o2", label: "" },
        { id: "o3", label: "" },
      ],
    },
    matching: {
      pairs: [
        { id: "m1", left: "", right: "" },
        { id: "m2", left: "", right: "" },
      ],
    },
    numerical: { expected: null, tolerance: 0 },
    dragDropFill: { tokens: [] },
    explanation: "",
    skills: [],
  };
}

export default function QuestionEditor({
  mode,
  examId,
  passageId,
  sectionId,
  questionId,
  initial,
  onClose,
}: Props) {
  const router = useRouter();
  const [v, setV] = useState<State>(() => {
    if (!initial) return defaultState(passageId);
    const s = defaultState(passageId);
    s.type = initial.type as QType;
    s.prompt = initial.prompt;
    s.points = initial.points;
    s.skills = initial.skills;
    const cfg = initial.config;
    s.explanation = (cfg.explanation as string) ?? "";
    if (s.type === "mcq" || s.type === "multi") {
      s.options = (cfg.options as State["options"]) ?? s.options;
    } else if (s.type === "true_false_notgiven") {
      s.tfng = (cfg.correct as State["tfng"]) ?? "true";
    } else if (s.type === "gap_fill") {
      s.blanks = ((cfg.blanks as Array<{ id: string; acceptedAnswers: string[]; matchMode?: string }>) ?? []).map(
        (b) => ({
          id: b.id,
          acceptedAnswers: (b.acceptedAnswers ?? []).join("; "),
          matchMode: (b.matchMode as "exact" | "case_insensitive") ?? "case_insensitive",
        }),
      );
    } else if (s.type === "short_answer") {
      s.shortAccepted = ((cfg.acceptedAnswers as string[]) ?? []).join("; ");
      s.shortMatchMode = (cfg.matchMode as State["shortMatchMode"]) ?? "case_insensitive";
    } else if (s.type === "essay") {
      s.essayRubric = plainToRichHtml((cfg.rubric as string) ?? "");
      s.essayMinWords = (cfg.minWords as number) ?? 0;
    } else if (s.type === "ordering") {
      s.ordering = { items: (cfg.items as State["ordering"]["items"]) ?? s.ordering.items };
    } else if (s.type === "matching") {
      s.matching = { pairs: (cfg.pairs as State["matching"]["pairs"]) ?? s.matching.pairs };
    } else if (s.type === "numerical") {
      s.numerical = {
        expected: typeof cfg.expected === "number" ? cfg.expected : null,
        tolerance: typeof cfg.tolerance === "number" ? cfg.tolerance : 0,
      };
    } else if (s.type === "drag_drop_fill") {
      s.dragDropFill = { tokens: (cfg.tokens as State["dragDropFill"]["tokens"]) ?? [] };
    }
    return s;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Đợt 5 — bước chọn loại bằng picker dùng chung. Mở sẵn lúc tạo mới; lúc
  // sửa câu có sẵn thì để false (loại đã có), nhưng "Đổi loại" vẫn bật lại
  // được — giữ đúng khả năng cũ của <select> (đổi type lúc edit không reset
  // các field khác, y như trước).
  const [pickingType, setPickingType] = useState(mode === "create");

  if (pickingType) {
    return (
      <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50 p-4">
        <QuestionTypePicker
          types={EXAM_PICKER_TYPES}
          onPick={(t) => {
            setV((prev) => ({ ...prev, type: t as QType }));
            setPickingType(false);
          }}
          onCancel={mode === "create" ? onClose : () => setPickingType(false)}
        />
      </div>
    );
  }

  function buildConfig(): unknown {
    const base = buildTypeConfig();
    const explanation = v.explanation.trim();
    return explanation ? { ...(base as Record<string, unknown>), explanation } : base;
  }

  function buildTypeConfig(): unknown {
    switch (v.type) {
      case "mcq":
      case "multi":
        return { options: v.options.map((o) => ({ id: o.id, label: o.label, isCorrect: o.isCorrect })) };
      case "true_false_notgiven":
        return { correct: v.tfng };
      case "gap_fill":
        return {
          blanks: v.blanks.map((b) => ({
            id: b.id,
            acceptedAnswers: b.acceptedAnswers
              .split(";")
              .map((s) => s.trim())
              .filter(Boolean),
            matchMode: b.matchMode,
          })),
        };
      case "short_answer":
        return {
          acceptedAnswers: v.shortAccepted
            .split(";")
            .map((s) => s.trim())
            .filter(Boolean),
          matchMode: v.shortMatchMode,
        };
      case "essay": {
        const out: Record<string, unknown> = {};
        if (v.essayRubric) out.rubric = v.essayRubric;
        if (v.essayMinWords > 0) out.minWords = v.essayMinWords;
        return out;
      }
      case "ordering":
        return { items: v.ordering.items.filter((it) => it.label.trim().length > 0) };
      case "matching":
        return {
          pairs: v.matching.pairs.filter(
            (p) => p.left.trim().length > 0 && p.right.trim().length > 0,
          ),
        };
      case "numerical":
        return { expected: v.numerical.expected, tolerance: v.numerical.tolerance };
      case "drag_drop_fill":
        return { tokens: v.dragDropFill.tokens.filter((t) => t.label.trim().length > 0) };
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body: Record<string, unknown> = {
      type: v.type,
      prompt: v.prompt,
      points: v.points,
      passageId,
      config: buildConfig(),
      skillIds: v.skills.map((s) => s.id),
    };
    if (mode === "create" && sectionId) body.sectionId = sectionId;
    const url =
      mode === "create"
        ? `/api/exams/${examId}/questions`
        : `/api/exam-questions/${questionId}`;
    const res = await fetch(apiUrl(url), {
      method: mode === "create" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(typeof d?.error === "string" ? d.error : "save_failed");
      return;
    }
    // Thêm vào 1 section có sẵn (khung "Phần N") làm itemCount của nó lệch
    // khỏi "Chia đề thành nhiều phần" cho tới khi có sự kiện này.
    if (mode === "create" && sectionId)
      window.dispatchEvent(new Event("fbm:exam-sections-changed"));
    router.refresh();
    onClose();
  }

  // Helpers for MCQ/MULTI options
  const addOption = () => {
    const nextId = String.fromCharCode(97 + v.options.length); // a, b, c…
    setV({
      ...v,
      options: [...v.options, { id: nextId, label: "", isCorrect: false }],
    });
  };
  const removeOption = (id: string) =>
    setV({ ...v, options: v.options.filter((o) => o.id !== id) });
  const setOption = (id: string, patch: Partial<State["options"][number]>) => {
    setV({
      ...v,
      options: v.options.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    });
  };
  const toggleCorrect = (id: string) => {
    if (v.type === "mcq") {
      setV({ ...v, options: v.options.map((o) => ({ ...o, isCorrect: o.id === id })) });
    } else {
      setV({
        ...v,
        options: v.options.map((o) => (o.id === id ? { ...o, isCorrect: !o.isCorrect } : o)),
      });
    }
  };

  return (
    <form
      onSubmit={save}
      className="space-y-4 rounded-lg border-2 border-emerald-300 bg-emerald-50 p-4"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
        <div className="block">
          <span className="block text-sm font-medium">Loại câu hỏi</span>
          <div className="mt-1 flex items-center gap-2">
            <span className="rounded border border-emerald-300 bg-white px-2 py-1.5 text-sm font-medium text-emerald-700">
              {TYPE_LABELS[v.type]}
            </span>
            <button
              type="button"
              onClick={() => setPickingType(true)}
              className="link text-xs"
            >
              Đổi loại
            </button>
          </div>
        </div>
        <label className="block">
          <span className="block text-sm font-medium">Điểm</span>
          <input
            type="number"
            min={0}
            max={1000}
            value={v.points}
            onChange={(e) => setV({ ...v, points: Number(e.target.value) })}
            className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      {/* drag_drop_fill có ô "câu hỏi" riêng bên trong DragDropFillEditor
          (kèm cú pháp [[N]]) — ẩn ô chung ở đây để khỏi trùng lặp. */}
      {v.type !== "drag_drop_fill" && (
        <div>
          <label className="block text-sm font-medium">Đề câu hỏi</label>
          <textarea
            required
            rows={3}
            value={v.prompt}
            onChange={(e) => setV({ ...v, prompt: e.target.value })}
            className="mt-1 w-full rounded border border-default px-3 py-2 text-sm"
          />
        </div>
      )}

      {(v.type === "mcq" || v.type === "multi") && (
        <div className="rounded border border-default bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">Đáp án</span>
            <button
              type="button"
              onClick={addOption}
              className="rounded border border-default px-2 py-0.5 text-xs"
            >
              + Đáp án
            </button>
          </div>
          <ul className="space-y-2">
            {v.options.map((o) => (
              <li key={o.id} className="flex items-center gap-2">
                <input
                  type={v.type === "mcq" ? "radio" : "checkbox"}
                  checked={o.isCorrect}
                  onChange={() => toggleCorrect(o.id)}
                  name="correct"
                />
                <input
                  type="text"
                  value={o.label}
                  onChange={(e) => setOption(o.id, { label: e.target.value })}
                  placeholder={`Đáp án ${o.id.toUpperCase()}`}
                  className="flex-1 rounded border border-default px-2 py-1 text-sm"
                />
                {v.options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(o.id)}
                    className="text-xs text-red-600"
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-faint">
            {v.type === "mcq"
              ? "Chọn đúng 1 đáp án đúng."
              : "Chọn ≥ 1 đáp án đúng. Học viên phải chọn đúng cả tập để được điểm."}
          </p>
        </div>
      )}

      {v.type === "true_false_notgiven" && (
        <label className="block">
          <span className="block text-sm font-medium">Đáp án đúng</span>
          <select
            value={v.tfng}
            onChange={(e) =>
              setV({ ...v, tfng: e.target.value as "true" | "false" | "notgiven" })
            }
            className="mt-1 rounded border border-default px-2 py-1 text-sm"
          >
            <option value="true">TRUE</option>
            <option value="false">FALSE</option>
            <option value="notgiven">NOT GIVEN</option>
          </select>
        </label>
      )}

      {v.type === "gap_fill" && (
        <div className="rounded border border-default bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">Chỗ trống</span>
            <button
              type="button"
              onClick={() =>
                setV({
                  ...v,
                  blanks: [
                    ...v.blanks,
                    {
                      id: `b${v.blanks.length + 1}`,
                      acceptedAnswers: "",
                      matchMode: "case_insensitive",
                    },
                  ],
                })
              }
              className="rounded border border-default px-2 py-0.5 text-xs"
            >
              + Chỗ trống
            </button>
          </div>
          <ul className="space-y-2">
            {v.blanks.map((b, i) => (
              <li key={b.id} className="flex items-center gap-2">
                <span className="w-12 text-xs text-faint">{b.id}</span>
                <input
                  type="text"
                  value={b.acceptedAnswers}
                  onChange={(e) =>
                    setV({
                      ...v,
                      blanks: v.blanks.map((x, j) =>
                        j === i ? { ...x, acceptedAnswers: e.target.value } : x,
                      ),
                    })
                  }
                  placeholder="đáp án 1 ; đáp án 2"
                  className="flex-1 rounded border border-default px-2 py-1 text-sm"
                />
                <select
                  value={b.matchMode}
                  onChange={(e) =>
                    setV({
                      ...v,
                      blanks: v.blanks.map((x, j) =>
                        j === i
                          ? { ...x, matchMode: e.target.value as "exact" | "case_insensitive" }
                          : x,
                      ),
                    })
                  }
                  className="rounded border border-default px-1 py-1 text-xs"
                >
                  <option value="case_insensitive">không phân biệt hoa thường</option>
                  <option value="exact">khớp tuyệt đối</option>
                </select>
                {v.blanks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setV({ ...v, blanks: v.blanks.filter((_, j) => j !== i) })}
                    className="text-xs text-red-600"
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {v.type === "short_answer" && (
        <div className="space-y-2 rounded border border-default bg-white p-3">
          <label className="block">
            <span className="block text-sm font-medium">
              Các đáp án chấp nhận (phân tách bởi “;”)
            </span>
            <input
              type="text"
              value={v.shortAccepted}
              onChange={(e) => setV({ ...v, shortAccepted: e.target.value })}
              placeholder="paris ; Paris ; PARIS"
              className="mt-1 w-full rounded border border-default px-2 py-1 text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium">Chế độ so khớp</span>
            <select
              value={v.shortMatchMode}
              onChange={(e) =>
                setV({
                  ...v,
                  shortMatchMode: e.target.value as "exact" | "case_insensitive",
                })
              }
              className="mt-1 rounded border border-default px-2 py-1 text-sm"
            >
              <option value="case_insensitive">Không phân biệt hoa thường</option>
              <option value="exact">Khớp tuyệt đối</option>
            </select>
          </label>
        </div>
      )}

      {v.type === "essay" && (
        <div className="space-y-2 rounded border border-default bg-white p-3">
          <div>
            <span className="block text-sm font-medium">Rubric (tuỳ chọn)</span>
            <div className="mt-1">
              <RichTextEditor
                value={v.essayRubric}
                onChange={(html) => setV({ ...v, essayRubric: html })}
                placeholder="Tiêu chí chấm bài…"
                minHeight={100}
              />
            </div>
          </div>
          <label className="block">
            <span className="block text-sm font-medium">Số từ tối thiểu (0 = không yêu cầu)</span>
            <input
              type="number"
              min={0}
              max={10000}
              value={v.essayMinWords}
              onChange={(e) => setV({ ...v, essayMinWords: Number(e.target.value) })}
              className="mt-1 w-32 rounded border border-default px-2 py-1 text-sm"
            />
          </label>
        </div>
      )}

      {/* Đợt 8 — 4 loại mới, dùng editor DÙNG CHUNG (apps/web/src/components/question-editor/). */}
      {v.type === "ordering" && (
        <div className="rounded border border-default bg-white p-3">
          <OrderingEditor value={v.ordering} onChange={(ordering) => setV({ ...v, ordering })} />
        </div>
      )}
      {v.type === "matching" && (
        <div className="rounded border border-default bg-white p-3">
          <MatchingEditor value={v.matching} onChange={(matching) => setV({ ...v, matching })} />
        </div>
      )}
      {v.type === "numerical" && (
        <div className="rounded border border-default bg-white p-3">
          <NumericalEditor value={v.numerical} onChange={(numerical) => setV({ ...v, numerical })} />
        </div>
      )}
      {v.type === "drag_drop_fill" && (
        <div className="rounded border border-default bg-white p-3">
          <DragDropFillEditor
            prompt={v.prompt}
            onPrompt={(prompt) => setV({ ...v, prompt })}
            value={v.dragDropFill}
            onChange={(dragDropFill) => setV({ ...v, dragDropFill })}
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium">
          Giải thích đáp án{" "}
          <span className="font-normal text-faint">(không bắt buộc)</span>
        </label>
        <textarea
          rows={2}
          value={v.explanation}
          onChange={(e) => setV({ ...v, explanation: e.target.value })}
          placeholder="Vì sao đáp án này đúng — học sinh đọc được sau khi bài được chấm."
          className="mt-1 w-full rounded border border-default px-3 py-2 text-sm"
        />
        <p className="mt-1 text-caption text-faint">
          Chỉ hiện khi đề bật “Hiện kết quả sau khi nộp”. Để trống thì học sinh
          không thấy khối giải thích.
        </p>
      </div>

      <div>
        <span className="block text-sm font-medium">Skill liên quan (bắt buộc khi publish)</span>
        <div className="mt-1">
          <SkillPicker value={v.skills} onChange={(s) => setV({ ...v, skills: s })} />
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">
          Lỗi: {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-default px-4 py-1.5 text-sm"
        >
          Huỷ
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Đang lưu…" : mode === "create" ? "Thêm câu hỏi" : "Lưu"}
        </button>
      </div>
    </form>
  );
}
