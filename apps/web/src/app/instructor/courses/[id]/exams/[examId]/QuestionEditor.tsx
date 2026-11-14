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
import { isPlayableExamQuestionType } from "@/lib/examQuestionSupport";
import { buildEssayConfig, emptyFreeChatDraft, essayDraftFromConfig, freeChatDraftFromConfig, rolePlayDraftFromConfig, type FreeChatDraft, type RolePlayDraft } from "@/lib/essayQuestionConfig";
import { parseScript } from "@/lib/rolePlayView";
import EssayAudioField from "./EssayAudioField";

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

/** Đề Khảo sát (docs/tieu-chi/de-thi-khao-sat.md AC2–AC3) — câu không có đáp án đúng. */
const SURVEY_TYPES = ["mcq", "multi", "slider", "short_answer", "essay"] as const;
const SURVEY_TYPE_LABELS: Record<string, string> = {
  mcq: "Một lựa chọn",
  multi: "Nhiều lựa chọn",
  slider: "Thang trượt",
  short_answer: "Trả lời ngắn",
  essay: "Trả lời dài",
};
const SURVEY_TYPE_HINT: Record<string, string> = {
  mcq: "Ví dụ thang 1–5 (Hoàn toàn không đúng … Hoàn toàn đúng)",
  multi: "Chọn tất cả ý đúng với mình",
  slider: "Kéo chọn một số, ví dụ 0–100",
  short_answer: "Một dòng chữ",
  essay: "Câu hỏi mở, nhiều dòng",
};

interface SliderDraft {
  min: number;
  max: number;
  step: number;
  minLabel: string;
  maxLabel: string;
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
  slider: "Thang trượt",
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
  /** Audio bài mẫu của câu tự luận (đường dẫn kho đề; rỗng = không có). */
  essayAudio: string;
  /** Bài luyện: cho học viên trả lời bằng giọng nói / AI nhận xét (mặc định bật). */
  essayVoice: boolean;
  essayAi: boolean;
  /** Bài luyện: hội thoại đóng vai (kịch bản chữ, tên vai, audio từng lượt). */
  roleplay: RolePlayDraft;
  /** Bài luyện: kiểu hội thoại với bạn ảo của câu tự luận (chọn một) và cấu hình "nói tự do". */
  convMode: "none" | "script" | "free";
  freechat: FreeChatDraft;
  // Đợt 8 — 4 loại mới, dùng thẳng shape canonical.
  ordering: OrderingDraft;
  matching: MatchingDraft;
  numerical: NumericalDraft;
  dragDropFill: DragDropFillDraft;
  /** Giải thích đáp án — HS đọc sau khi bài được chấm. Lưu trong config. */
  explanation: string;
  skills: Skill[];
  /** Đề Khảo sát: mã câu (tiêu đề cột khi xuất) và cấu hình thang trượt. */
  code: string;
  slider: SliderDraft;
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
  /** Đề Khảo sát: không đáp án đúng, không điểm, không giải thích/skill. */
  survey?: boolean;
  onClose: () => void;
  /** Bài luyện trong bài học: bỏ ô Điểm và Skill; câu Tự luận có thêm bài mẫu, audio mẫu, tiêu chí cho AI và hai công tắc giọng nói / AI. */
  practiceMode?: boolean;
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
    essayAudio: "",
    essayVoice: true,
    essayAi: true,
    roleplay: { text: "", roleA: "", roleB: "", audio: [] },
    convMode: "none",
    freechat: emptyFreeChatDraft(),
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
    code: "",
    slider: { min: 0, max: 100, step: 10, minLabel: "", maxLabel: "" },
  };
}

export default function QuestionEditor({
  mode,
  examId,
  passageId,
  sectionId,
  questionId,
  initial,
  survey = false,
  onClose,
  practiceMode = false,
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
    s.code = typeof cfg.code === "string" ? cfg.code : "";
    if (s.type === "slider") {
      s.slider = {
        min: typeof cfg.min === "number" ? cfg.min : 0,
        max: typeof cfg.max === "number" ? cfg.max : 100,
        step: typeof cfg.step === "number" ? cfg.step : 1,
        minLabel: typeof cfg.minLabel === "string" ? cfg.minLabel : "",
        maxLabel: typeof cfg.maxLabel === "string" ? cfg.maxLabel : "",
      };
    }
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
      const e = essayDraftFromConfig(cfg, plainToRichHtml);
      s.essayRubric = e.rubric;
      s.essayMinWords = e.minWords;
      s.essayAudio = e.explanationAudio;
      s.essayVoice = e.voiceAnswer;
      s.essayAi = e.aiFeedback;
      s.roleplay = rolePlayDraftFromConfig(cfg);
      s.freechat = freeChatDraftFromConfig(cfg);
      s.convMode = cfg.freechat ? "free" : cfg.roleplay ? "script" : "none";
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

  if (pickingType && survey) {
    return (
      <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50 p-4">
        <p className="mb-3 text-sm font-medium">Chọn dạng câu</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SURVEY_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setV((prev) => ({ ...prev, type: t as QType }));
                setPickingType(false);
              }}
              className="rounded border border-default bg-white px-3 py-2 text-left hover:border-brand-300 hover:bg-brand-soft"
            >
              <span className="block text-sm font-medium">{SURVEY_TYPE_LABELS[t]}</span>
              <span className="block text-caption text-faint">{SURVEY_TYPE_HINT[t]}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={mode === "create" ? onClose : () => setPickingType(false)}
          className="mt-3 text-sm text-faint hover:underline"
        >
          Huỷ
        </button>
      </div>
    );
  }

  if (pickingType) {
    return (
      <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50 p-4">
        <QuestionTypePicker
          // Chỉ loại trình làm bài vẽ được (isPlayableExamQuestionType): Sắp xếp, Ghép cặp, Số, Kéo thả tạm ẩn cho tới khi
          // trình làm bài hỗ trợ — tránh tạo câu học viên không làm được. Câu đã tạo vẫn sửa được.
          types={EXAM_PICKER_TYPES.filter(isPlayableExamQuestionType)}
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
    if (survey) {
      const code = v.code.trim();
      return { ...(buildSurveyConfig() as Record<string, unknown>), ...(code ? { code } : {}) };
    }
    const base = buildTypeConfig();
    const explanation = v.explanation.trim();
    return explanation ? { ...(base as Record<string, unknown>), explanation } : base;
  }

  function buildSurveyConfig(): unknown {
    switch (v.type) {
      case "mcq":
      case "multi":
        return { options: v.options.map((o) => ({ id: o.id, label: o.label })) };
      case "slider":
        return {
          min: v.slider.min,
          max: v.slider.max,
          step: v.slider.step,
          ...(v.slider.minLabel.trim() ? { minLabel: v.slider.minLabel.trim() } : {}),
          ...(v.slider.maxLabel.trim() ? { maxLabel: v.slider.maxLabel.trim() } : {}),
        };
      default:
        return {};
    }
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
      case "essay":
        // Hai công tắc và audio mẫu chỉ có ở Bài luyện; ở đề thi thường giữ nguyên như trước (không ghi khoá mới).
        return buildEssayConfig({
          rubric: v.essayRubric,
          minWords: v.essayMinWords,
          explanation: v.explanation,
          explanationAudio: practiceMode ? v.essayAudio : "",
          voiceAnswer: practiceMode ? v.essayVoice : true,
          aiFeedback: practiceMode ? v.essayAi : true,
        }, practiceMode && v.convMode === "script" ? v.roleplay : undefined, practiceMode && v.convMode === "free" ? v.freechat : undefined);
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
    if (survey && v.type === "slider") {
      const { min, max, step } = v.slider;
      if (!(max > min)) return setError("“Lớn nhất” phải lớn hơn “Nhỏ nhất”.");
      if (!(step > 0) || (max - min) % step !== 0)
        return setError("(Lớn nhất − Nhỏ nhất) phải chia hết cho “Bước”.");
    }
    if (survey && v.code.trim() && !/^[\p{L}\p{N}_.-]+$/u.test(v.code.trim()))
      return setError("Mã câu chỉ gồm chữ, số và các dấu _ . - (không có khoảng trắng).");
    setSaving(true);
    setError(null);
    const body: Record<string, unknown> = {
      type: v.type,
      prompt: v.prompt,
      points: survey ? 0 : v.points,
      passageId,
      config: buildConfig(),
      skillIds: survey ? [] : v.skills.map((s) => s.id),
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
      const raw = typeof d?.error === "string" ? d.error : "save_failed";
      setError(
        JSON.stringify(d).includes("survey_code_duplicate")
          ? "Mã câu này đã dùng cho một câu khác trong phiếu."
          : raw,
      );
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
              {survey ? SURVEY_TYPE_LABELS[v.type] ?? TYPE_LABELS[v.type] : TYPE_LABELS[v.type]}
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
        {survey ? (
          <label className="block">
            <span className="block text-sm font-medium">
              Mã câu <span className="font-normal text-faint">(không bắt buộc)</span>
            </span>
            <input
              type="text"
              maxLength={20}
              value={v.code}
              onChange={(e) => setV({ ...v, code: e.target.value })}
              placeholder="vd TT01"
              className="mt-1 w-full rounded border border-default px-2 py-1.5 font-mono text-sm"
            />
            <span className="mt-1 block text-caption text-faint">Tiêu đề cột khi xuất Excel; sinh viên không thấy.</span>
          </label>
        ) : !practiceMode && (
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
        )}
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
            <span className="text-sm font-medium">{survey ? "Các lựa chọn (theo thứ tự xuất 1, 2, 3…)" : "Đáp án"}</span>
            <button
              type="button"
              onClick={addOption}
              disabled={survey && v.options.length >= 10}
              className="rounded border border-default px-2 py-0.5 text-xs disabled:opacity-40"
            >
              {survey ? "+ Lựa chọn" : "+ Đáp án"}
            </button>
          </div>
          <ul className="space-y-2">
            {v.options.map((o, oi) => (
              <li key={o.id} className="flex items-center gap-2">
                {survey ? (
                  <span className="w-5 text-right text-xs font-medium text-faint">{oi + 1}</span>
                ) : (
                <input
                  type={v.type === "mcq" ? "radio" : "checkbox"}
                  checked={o.isCorrect}
                  onChange={() => toggleCorrect(o.id)}
                  name="correct"
                />
                )}
                <input
                  type="text"
                  value={o.label}
                  required={survey}
                  onChange={(e) => setOption(o.id, { label: e.target.value })}
                  placeholder={survey ? `Lựa chọn ${oi + 1}` : `Đáp án ${o.id.toUpperCase()}`}
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
            {survey
              ? "Không có đáp án đúng. Khi xuất Excel, mỗi lựa chọn ghi bằng số thứ tự ở bên trái."
              : v.type === "mcq"
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

      {survey && v.type === "slider" && (
        <div className="grid grid-cols-1 gap-3 rounded border border-default bg-white p-3 sm:grid-cols-3">
          {(
            [
              ["min", "Nhỏ nhất"],
              ["max", "Lớn nhất"],
              ["step", "Bước"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="block">
              <span className="block text-sm font-medium">{label}</span>
              <input
                type="number"
                required
                min={k === "step" ? 1 : -1000}
                max={1000}
                value={v.slider[k]}
                onChange={(e) => setV({ ...v, slider: { ...v.slider, [k]: Number(e.target.value) } })}
                className="mt-1 w-full rounded border border-default px-2 py-1 text-sm"
              />
            </label>
          ))}
          <label className="block sm:col-span-3 sm:grid sm:grid-cols-2 sm:gap-3">
            <span className="block">
              <span className="block text-sm font-medium">Nhãn đầu nhỏ</span>
              <input
                type="text"
                maxLength={60}
                value={v.slider.minLabel}
                onChange={(e) => setV({ ...v, slider: { ...v.slider, minLabel: e.target.value } })}
                placeholder="vd Rất thấp"
                className="mt-1 w-full rounded border border-default px-2 py-1 text-sm"
              />
            </span>
            <span className="mt-3 block sm:mt-0">
              <span className="block text-sm font-medium">Nhãn đầu lớn</span>
              <input
                type="text"
                maxLength={60}
                value={v.slider.maxLabel}
                onChange={(e) => setV({ ...v, slider: { ...v.slider, maxLabel: e.target.value } })}
                placeholder="vd Rất cao"
                className="mt-1 w-full rounded border border-default px-2 py-1 text-sm"
              />
            </span>
          </label>
          <p className="text-caption text-faint sm:col-span-3">
            (Lớn nhất − Nhỏ nhất) phải chia hết cho Bước. Sinh viên chưa chạm vào thanh thì câu được tính là chưa trả lời.
          </p>
        </div>
      )}

      {!survey && v.type === "short_answer" && (
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

      {!survey && v.type === "essay" && (
        <div className="space-y-3 rounded border border-default bg-white p-3">
          <div>
            <span className="block text-sm font-medium">
              {practiceMode ? "Tiêu chí đánh giá cho AI" : "Rubric (tuỳ chọn)"}
            </span>
            <div className="mt-1">
              <RichTextEditor
                value={v.essayRubric}
                onChange={(html) => setV({ ...v, essayRubric: html })}
                placeholder={practiceMode ? "Ví dụ: Nêu ít nhất ba mốc thời gian; dùng thì quá khứ." : "Tiêu chí chấm bài…"}
                minHeight={100}
              />
            </div>
            {practiceMode && (
              <p className="mt-1 text-caption text-faint">
                Điều AI cần xét khi góp ý; để trống thì AI chỉ dựa vào đề và bài mẫu.
              </p>
            )}
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
          {practiceMode && (
            <>
              <EssayAudioField examId={examId} value={v.essayAudio} onChange={(essayAudio) => setV({ ...v, essayAudio })} />
              <ConversationFields
                examId={examId}
                mode={v.convMode}
                onMode={(convMode) => setV({ ...v, convMode })}
                roleplay={v.roleplay}
                onRoleplay={(roleplay) => setV({ ...v, roleplay })}
                freechat={v.freechat}
                onFreechat={(freechat) => setV({ ...v, freechat })}
              />
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={v.essayVoice}
                  onChange={(e) => setV({ ...v, essayVoice: e.target.checked })}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium">Cho trả lời bằng giọng nói</span>
                  <span className="block text-caption text-faint">Học viên có nút ghi âm cạnh ô gõ chữ; bản ghi được chuyển thành chữ để học viên sửa.</span>
                </span>
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={v.essayAi}
                  onChange={(e) => setV({ ...v, essayAi: e.target.checked })}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium">AI nhận xét câu trả lời</span>
                  <span className="block text-caption text-faint">Khi học viên bấm “Kiểm tra câu n”, AI góp ý ngay (không chấm điểm, không vào sổ điểm).</span>
                </span>
              </label>
            </>
          )}
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

      <div className={survey ? "hidden" : undefined}>
        <label className="block text-sm font-medium">
          {practiceMode && v.type === "essay" ? "Bài mẫu (Sample answer)" : "Giải thích đáp án"}{" "}
          <span className="font-normal text-faint">(không bắt buộc)</span>
        </label>
        <textarea
          rows={practiceMode && v.type === "essay" ? 4 : 2}
          value={v.explanation}
          onChange={(e) => setV({ ...v, explanation: e.target.value })}
          placeholder={
            practiceMode && v.type === "essay"
              ? "Câu trả lời mẫu (ví dụ từ Teacher's Book) để học viên đối chiếu."
              : "Vì sao đáp án này đúng — học sinh đọc được sau khi bài được chấm."
          }
          className="mt-1 w-full rounded border border-default px-3 py-2 text-sm"
        />
        <p className="mt-1 text-caption text-faint">
          {practiceMode && v.type === "essay"
            ? "Học viên thấy sau khi kiểm tra, dưới câu trả lời của chính họ. AI cũng dùng bài mẫu để so sánh khi góp ý. Để trống thì không hiện khối bài mẫu."
            : practiceMode
            ? "Hiện cho học viên ngay khi họ bấm “Kiểm tra câu n”; nên chỉ rõ đoạn nào của bài đọc/bài nghe chứng minh đáp án. Để trống thì học viên không thấy khối giải thích."
            : "Ở đề thi, chỉ hiện khi đề bật “Hiện kết quả sau khi nộp”. Ở “Bài luyện” nhúng trong bài học, hiện ngay khi học viên bấm “Kiểm tra câu n”; nên chỉ rõ đoạn nào của bài đọc/bài nghe chứng minh đáp án. Để trống thì học viên không thấy khối giải thích."}
        </p>
      </div>

      {!practiceMode && !survey && (
      <div>
        <span className="block text-sm font-medium">Skill liên quan (bắt buộc khi publish)</span>
        <div className="mt-1">
          <SkillPicker value={v.skills} onChange={(s) => setV({ ...v, skills: s })} />
        </div>
      </div>
      )}

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

/**
 * Hội thoại đóng vai của câu tự luận trong Bài luyện (docs/tieu-chi/limio-language-luyen-hoi-thoai-dong-vai.md): kịch bản viết bằng chữ, mỗi dòng
 * "A: câu" hoặc "B: câu"; có từ 2 lượt thì câu hiện thành hội thoại cho học viên chọn vai và ghi âm. Audio từng lượt tải lên theo thứ tự lượt.
 */
function RolePlayFields({ examId, value, onChange }: { examId: string; value: RolePlayDraft; onChange: (v: RolePlayDraft) => void }) {
  const { turns, badLines } = parseScript(value.text);
  const active = turns.length >= 2;
  return (
    <div className="space-y-2 rounded border border-default p-3" data-testid="roleplay-fields">
      <div>
        <span className="block text-sm font-medium">Hội thoại đóng vai (tuỳ chọn)</span>
        <p className="text-caption text-faint">
          Mỗi dòng một lượt, bắt đầu bằng "A:" hoặc "B:". Có từ 2 lượt thì học viên chọn đóng A hoặc B, nghe vai kia và ghi âm lượt của mình; AI nhận xét so với kịch bản này. Để trống thì câu là câu mở thường.
        </p>
      </div>
      <textarea
        value={value.text}
        onChange={(e) => onChange({ ...value, text: e.target.value })}
        rows={6}
        placeholder={"A: Chocolate! It's good for energy.\nB: I was thinking the same thing."}
        className="w-full rounded border border-default px-2 py-1 text-sm"
        aria-label="Kịch bản hội thoại"
      />
      {badLines.length > 0 && (
        <p role="alert" className="text-caption text-red-700">
          Dòng {badLines.join(", ")} không bắt đầu bằng "A:" hoặc "B:" nên bị bỏ qua.
        </p>
      )}
      {value.text.trim() && !active && (
        <p className="text-caption text-red-700">Cần ít nhất 2 lượt thì mới thành hội thoại; hiện chỉ có {turns.length}.</p>
      )}
      {active && (
        <>
          <div className="flex flex-wrap gap-3">
            <label className="block">
              <span className="block text-sm font-medium">Tên vai A (tuỳ chọn)</span>
              <input value={value.roleA} maxLength={60} onChange={(e) => onChange({ ...value, roleA: e.target.value })} className="mt-1 w-44 rounded border border-default px-2 py-1 text-sm" />
            </label>
            <label className="block">
              <span className="block text-sm font-medium">Tên vai B (tuỳ chọn)</span>
              <input value={value.roleB} maxLength={60} onChange={(e) => onChange({ ...value, roleB: e.target.value })} className="mt-1 w-44 rounded border border-default px-2 py-1 text-sm" />
            </label>
          </div>
          <p className="text-caption text-faint">
            Audio từng lượt (tuỳ chọn): tải lên theo đúng thứ tự lượt. Đổi thứ tự hoặc xoá lượt thì kiểm lại audio.
          </p>
          <ol className="space-y-2">
            {turns.map((t, i) => (
              <li key={i} className="rounded border border-default p-2">
                <p className="mb-1 text-sm">
                  <b>
                    {i + 1}. {t.speaker}:
                  </b>{" "}
                  {t.text}
                </p>
                <EssayAudioField
                  examId={examId}
                  value={value.audio[i] ?? ""}
                  onChange={(url) => {
                    const audio = [...value.audio];
                    while (audio.length < turns.length) audio.push("");
                    audio[i] = url;
                    onChange({ ...value, audio });
                  }}
                  label={`Audio lượt ${i + 1}`}
                  altText={`Hội thoại, lượt ${i + 1}`}
                  hint="Có thể để trống: lượt không có audio thì học viên chỉ đọc chữ."
                />
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

/**
 * Hội thoại với bạn ảo của câu tự luận trong Bài luyện: chọn MỘT kiểu — không, "Đóng vai theo kịch bản" (nghe vai kia, ghi âm lượt của mình) hoặc
 * "Nói tự do với bạn ảo" (chatbot đóng vai, gõ hoặc nói). docs/tieu-chi/limio-language-noi-tu-do-voi-ban-ao.md (AC5).
 */
function ConversationFields({
  examId,
  mode,
  onMode,
  roleplay,
  onRoleplay,
  freechat,
  onFreechat,
}: {
  examId: string;
  mode: "none" | "script" | "free";
  onMode: (m: "none" | "script" | "free") => void;
  roleplay: RolePlayDraft;
  onRoleplay: (v: RolePlayDraft) => void;
  freechat: FreeChatDraft;
  onFreechat: (v: FreeChatDraft) => void;
}) {
  return (
    <div className="space-y-2 rounded border border-default p-3" data-testid="conversation-fields">
      <label className="block">
        <span className="block text-sm font-medium">Hội thoại với bạn ảo (tuỳ chọn)</span>
        <select value={mode} onChange={(e) => onMode(e.target.value as "none" | "script" | "free")} className="mt-1 rounded border border-default px-2 py-1 text-sm" aria-label="Kiểu hội thoại với bạn ảo">
          <option value="none">Không (câu mở thường)</option>
          <option value="script">Đóng vai theo kịch bản</option>
          <option value="free">Nói tự do với bạn ảo (chatbot)</option>
        </select>
      </label>
      {mode === "script" && <RolePlayFields examId={examId} value={roleplay} onChange={onRoleplay} />}
      {mode === "free" && <FreeChatFields value={freechat} onChange={onFreechat} />}
    </div>
  );
}

function FreeChatFields({ value, onChange }: { value: FreeChatDraft; onChange: (v: FreeChatDraft) => void }) {
  const set = (patch: Partial<FreeChatDraft>) => onChange({ ...value, ...patch });
  const missing = !value.scenario.trim() || !value.opening.trim();
  return (
    <div className="space-y-2" data-testid="freechat-fields">
      <p className="text-caption text-faint">
        Học viên trò chuyện với một chatbot đóng vai (gõ hoặc nói, tối đa 8 lượt mặc định); AI nhận xét lời của học viên ở cuối. Cần có tình huống và lời mở đầu của bạn ảo.
      </p>
      <label className="block">
        <span className="block text-sm font-medium">Tình huống</span>
        <textarea value={value.scenario} maxLength={600} rows={2} onChange={(e) => set({ scenario: e.target.value })} className="mt-1 w-full rounded border border-default px-2 py-1 text-sm" placeholder="Hai người bạn chọn đồ mang theo khi phải rời nhà gấp." aria-label="Tình huống" />
      </label>
      <label className="block">
        <span className="block text-sm font-medium">Lời mở đầu của bạn ảo (tiếng Anh)</span>
        <input value={value.opening} maxLength={300} onChange={(e) => set({ opening: e.target.value })} className="mt-1 w-full rounded border border-default px-2 py-1 text-sm" placeholder="Our house is on fire! What would you take?" aria-label="Lời mở đầu của bạn ảo" />
      </label>
      <div className="flex flex-wrap gap-3">
        <label className="block">
          <span className="block text-sm font-medium">Tên vai của bạn ảo (tuỳ chọn)</span>
          <input value={value.partnerRole} maxLength={60} onChange={(e) => set({ partnerRole: e.target.value })} className="mt-1 w-44 rounded border border-default px-2 py-1 text-sm" />
        </label>
        <label className="block">
          <span className="block text-sm font-medium">Tên vai của học viên (tuỳ chọn)</span>
          <input value={value.learnerRole} maxLength={60} onChange={(e) => set({ learnerRole: e.target.value })} className="mt-1 w-44 rounded border border-default px-2 py-1 text-sm" />
        </label>
        <label className="block">
          <span className="block text-sm font-medium">Số lượt tối đa (4–12)</span>
          <input type="number" min={4} max={12} value={value.maxTurns} onChange={(e) => set({ maxTurns: Number(e.target.value) })} className="mt-1 w-24 rounded border border-default px-2 py-1 text-sm" />
        </label>
      </div>
      <label className="block">
        <span className="block text-sm font-medium">Cụm mục tiêu (mỗi dòng một cụm, tối đa 10)</span>
        <textarea value={value.targets} rows={4} onChange={(e) => set({ targets: e.target.value })} className="mt-1 w-full rounded border border-default px-2 py-1 text-sm" placeholder={"I'm not sure about that\nThat's not really essential"} aria-label="Cụm mục tiêu" />
        <span className="block text-caption text-faint">Học viên thấy các cụm này để dùng; cụm nào đã dùng thì được đánh dấu ✓. Bạn ảo cũng dùng tự nhiên một vài cụm. Có "…" ở cuối thì chỉ cần dùng phần đầu.</span>
      </label>
      {missing && (
        <p role="alert" className="text-caption text-red-700">
          Chưa đủ tình huống và lời mở đầu thì câu này vẫn là câu mở thường.
        </p>
      )}
    </div>
  );
}
