"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import SafeHtml from "@/components/SafeHtml";
import PromptAid from "@/components/language/PromptAid";
import RubyText from "@/components/RubyText";
import { parsePromptAid } from "@/lib/promptAid";
import { promptSyllables, questionHidesPinyin, sliceByHan } from "@/lib/promptRuby";
import { plainToRichHtml } from "@/lib/richText";
import { splitSingleBlank } from "@/lib/inlineBlank";
import { UNPLAYABLE_FOR_LEARNER } from "@/lib/examQuestionSupport";
import { DragDropFillQuestion, MatchingQuestion, NumericalQuestion, OrderingQuestion } from "./ExamQuestionExtraTypes";

export type AnswerValue =
  | { optionIds: string[] }
  | { correct: "true" | "false" | "notgiven" }
  | { blanks: Record<string, string> }
  | { text: string }
  // Sắp xếp: mã công khai theo thứ tự học viên xếp. Ghép cặp: mã cặp (vế trái) → mã công khai của vế phải đã chọn.
  // Kéo thả điền: số ô trống → mã công khai của token đã đặt. Số: giá trị nhập (chuỗi hoặc số).
  | { order: string[] }
  | { matched: Record<string, string> }
  | { placed: Record<string, string> }
  | { value: string | number }
  | null;

/**
 * Câu đã có đáp án chưa — MỘT hàm cho mọi trình làm bài (đề thi, luyện đề, Bài luyện), để thêm loại câu mới chỉ sửa một chỗ.
 * Phải khớp điều kiện máy chủ thật sự chấp nhận làm đáp án (rỗng thì không lưu, không cho "Kiểm tra").
 */
export function isAnswerValueAnswered(v: AnswerValue): boolean {
  if (v == null) return false;
  if ("optionIds" in v) return v.optionIds.length > 0;
  if ("correct" in v) return !!v.correct;
  if ("blanks" in v) return Object.values(v.blanks).some((x) => typeof x === "string" && x.trim() !== "");
  if ("text" in v) return v.text.trim() !== "";
  if ("order" in v) return v.order.length > 0;
  if ("matched" in v) return Object.values(v.matched).some((x) => !!x);
  if ("placed" in v) return Object.values(v.placed).some((x) => !!x);
  if ("value" in v) return typeof v.value === "number" ? Number.isFinite(v.value) : String(v.value).trim() !== "";
  return false;
}

interface QuestionData {
  id: string;
  type: string;
  prompt: string;
  points: number;
  config: Record<string, unknown>;
}

interface Props {
  question: QuestionData;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
  optionOrder?: string[];
  /** Trong phiếu bài tập: ô trả lời tự luận thấp (3 dòng) và tự giãn theo chữ gõ, thay vì 8 dòng cố định. */
  compact?: boolean;
  /** Đáp án gõ ở nơi khác trên trang (vd. ô trống trong đoạn hội thoại của bài luyện): không vẽ ô soạn thảo ở câu tự luận. */
  hideAnswerInput?: boolean;
}

export default function ExamQuestion({ question, value, onChange, optionOrder, compact = false, hideAnswerInput = false }: Props) {
  // Câu tự luận trong phiếu bài tập có đúng một chỗ trống trong đề: gõ thẳng vào chỗ trống, không có ô soạn thảo riêng.
  const inlineBlank = useMemo(() => (question.type === "essay" && compact ? splitSingleBlank(question.prompt) : null), [question.type, question.prompt, compact]);
  // Đề chữ Hán có pinyin ghép được: hiện pinyin dưới từng chữ (ruby), không lặp dòng pinyin riêng bên dưới.
  // Câu hỏi về cách đọc (pinyin, thanh điệu…) thì không hiện pinyin của đề: sẽ lộ đáp án.
  const hidePy = useMemo(() => questionHidesPinyin(question.prompt, question.config), [question.prompt, question.config]);
  const syl = useMemo(() => (hidePy ? null : promptSyllables(question.prompt, parsePromptAid(question.config)?.reading)), [hidePy, question.prompt, question.config]);
  const prompt = syl ? (
    <p className="han-text ruby-line mb-2 text-lg" lang="zh-Hans">
      <RubyText text={question.prompt} syllables={syl} />
    </p>
  ) : (
    <SafeHtml
      html={plainToRichHtml(question.prompt)}
      className="prose prose-sm mb-2 max-w-none dark:prose-invert"
    />
  );
  const inner = useMemo(() => {
    switch (question.type) {
      case "mcq":
        return (
          <McqOptions
            config={question.config as unknown as McqConfig}
            value={value}
            onChange={onChange}
            optionOrder={optionOrder}
            single
          />
        );
      case "multi":
        return (
          <McqOptions
            config={question.config as unknown as McqConfig}
            value={value}
            onChange={onChange}
            optionOrder={optionOrder}
            single={false}
          />
        );
      case "true_false_notgiven":
        return <TfNgChoice value={value} onChange={onChange} />;
      case "gap_fill":
        return (
          <GapFill
            config={question.config as unknown as GapFillConfig}
            value={value}
            onChange={onChange}
          />
        );
      case "short_answer":
        return <ShortAnswerInput value={value} onChange={onChange} />;
      case "essay":
        return inlineBlank || hideAnswerInput ? null : <EssayInput value={value} onChange={onChange} compact={compact} />;
      case "ordering":
        return <OrderingQuestion questionId={question.id} config={question.config} value={value} onChange={onChange} />;
      case "matching":
        return <MatchingQuestion questionId={question.id} config={question.config} value={value} onChange={onChange} />;
      case "drag_drop_fill":
        return (
          <DragDropFillQuestion
            questionId={question.id}
            prompt={question.prompt}
            config={question.config}
            value={value}
            onChange={onChange}
          />
        );
      case "numerical":
        return <NumericalQuestion value={value} onChange={onChange} />;
      case "slider":
        return (
          <SliderInput
            config={question.config as unknown as SliderConfig}
            value={value}
            onChange={onChange}
          />
        );
      default:
        return (
          <p role="status" className="text-sm text-amber-800">{UNPLAYABLE_FOR_LEARNER}</p>
        );
    }
  }, [question, value, onChange, optionOrder, compact, inlineBlank, hideAnswerInput]);

  return (
    <div>
      {/* Kéo thả điền tự vẽ đề (kèm ô thả tại chỗ [[N]]), nên bỏ khối đề chung để không hiện ký hiệu [[N]] thô. */}
      {inlineBlank ? (
        <InlineBlankPrompt before={inlineBlank.before} after={inlineBlank.after} syllables={syl} value={value} onChange={onChange} />
      ) : (
        question.type !== "drag_drop_fill" && prompt
      )}
      {/* Chú giải đề (phiên âm + bản dịch ẩn). Kéo thả điền tự vẽ đề nên chú giải đặt sau phần kéo thả. */}
      {question.type !== "drag_drop_fill" && <PromptAid config={question.config} hideReading={!!syl || hidePy} />}
      {inner}
      {question.type === "drag_drop_fill" && <PromptAid config={question.config} hideReading={hidePy} />}
    </div>
  );
}

interface McqConfig {
  options: Array<{ id: string; label: string; isCorrect?: boolean }>;
}

function McqOptions({
  config,
  value,
  onChange,
  optionOrder,
  single,
}: {
  config: McqConfig;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
  optionOrder?: string[];
  single: boolean;
}) {
  const ordered = useMemo(() => {
    if (!optionOrder) return config.options;
    const byId = new Map(config.options.map((o) => [o.id, o]));
    return optionOrder
      .map((id) => byId.get(id))
      .filter((o): o is McqConfig["options"][number] => !!o);
  }, [config.options, optionOrder]);

  const selected = new Set(
    value && "optionIds" in value ? value.optionIds : [],
  );

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (single) {
      next.clear();
      next.add(id);
    } else if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onChange({ optionIds: Array.from(next) });
  };

  return (
    <ul className="space-y-1">
      {ordered.map((o) => (
        <li key={o.id}>
          <label className="flex cursor-pointer items-start gap-2 rounded px-2 py-1 hover:bg-slate-50">
            <input
              type={single ? "radio" : "checkbox"}
              checked={selected.has(o.id)}
              onChange={() => toggle(o.id)}
              className="mt-1"
            />
            <span className="text-sm">{o.label}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

function TfNgChoice({
  value,
  onChange,
}: {
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
}) {
  const current = value && "correct" in value ? value.correct : undefined;
  const choices: Array<{ id: "true" | "false" | "notgiven"; label: string }> = [
    { id: "true", label: "TRUE" },
    { id: "false", label: "FALSE" },
    { id: "notgiven", label: "NOT GIVEN" },
  ];
  return (
    <div className="flex gap-2">
      {choices.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onChange({ correct: c.id })}
          className={`rounded border px-3 py-1 text-sm ${
            current === c.id
              ? "border-blue-500 bg-blue-50 text-blue-800"
              : "border-default bg-white"
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

interface GapFillConfig {
  blanks: Array<{ id: string; acceptedAnswers: string[]; matchMode?: string }>;
}

function GapFill({
  config,
  value,
  onChange,
}: {
  config: GapFillConfig;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
}) {
  const current = value && "blanks" in value ? value.blanks : {};
  return (
    <div className="space-y-2">
      {config.blanks.map((b, i) => (
        <label key={b.id} className="flex items-center gap-2 text-sm">
          <span className="w-16 text-faint">Chỗ trống {i + 1}</span>
          <input
            type="text"
            value={current[b.id] ?? ""}
            onChange={(e) =>
              onChange({ blanks: { ...current, [b.id]: e.target.value } })
            }
            className="flex-1 rounded border border-default px-2 py-1"
          />
        </label>
      ))}
    </div>
  );
}

function ShortAnswerInput({
  value,
  onChange,
}: {
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
}) {
  const current = value && "text" in value ? value.text : "";
  return (
    <input
      type="text"
      value={current}
      onChange={(e) => onChange({ text: e.target.value })}
      className="w-full rounded border border-default px-2 py-1 text-sm"
      maxLength={500}
    />
  );
}

/** Ô viết gọn luôn cao ít nhất 3 dòng (72px). */
const ESSAY_MIN_PX = 72;

function EssayInput({
  value,
  onChange,
  compact,
}: {
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
  compact: boolean;
}) {
  const current = value && "text" in value ? value.text : "";
  const ref = useRef<HTMLTextAreaElement>(null);
  // Chế độ gọn: cao vừa chữ đã gõ (tối thiểu 3 dòng, tối đa ~14 dòng rồi cuộn), không chiếm nửa màn hình khi câu chỉ cần một dòng.
  // Dựng trong vùng đang ẩn (tab chưa mở) thì scrollHeight = 0: không để ô co về 0, và đo lại khi ô hiện ra.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!compact || !el) return;
    const fit = () => {
      el.style.height = "auto";
      el.style.height = `${Math.min(Math.max(el.scrollHeight, ESSAY_MIN_PX), 360)}px`;
    };
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (el.offsetWidth > 0 && el.scrollHeight > parseInt(el.style.height || "0", 10)) fit();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [compact, current]);
  return (
    <textarea
      ref={ref}
      value={current}
      onChange={(e) => onChange({ text: e.target.value })}
      rows={compact ? 3 : 8}
      className={`w-full rounded border border-default px-2 py-1 text-sm ${compact ? "min-h-[4.5rem] resize-none" : ""}`}
      placeholder="Viết bài làm của bạn ở đây…"
    />
  );
}

interface SliderConfig {
  min?: number;
  max?: number;
  step?: number;
  minLabel?: string;
  maxLabel?: string;
}

/**
 * Thang trượt của phiếu Khảo sát (docs/tieu-chi/de-thi-khao-sat.md AC3). Chưa chạm thì
 * KHÔNG có giá trị (thanh mờ, không lưu gì), để "chưa trả lời" khác "chọn số nhỏ nhất".
 */
function SliderInput({
  config,
  value,
  onChange,
}: {
  config: SliderConfig;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
}) {
  const min = config.min ?? 0;
  const max = config.max ?? 100;
  const step = config.step ?? 1;
  const raw = value && "value" in value ? value.value : null;
  const current = raw === null || raw === "" || !Number.isFinite(Number(raw)) ? null : Number(raw);
  const mid = min + Math.round((max - min) / 2 / step) * step;
  const pick = (v: string) => onChange({ value: Number(v) });
  return (
    <div className="max-w-xl">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={current ?? mid}
        onChange={(e) => pick(e.target.value)}
        // Chạm đúng điểm giữa khi chưa có giá trị không phát onChange — bắt thêm ở đây.
        onPointerUp={(e) => pick(e.currentTarget.value)}
        aria-label="Chọn giá trị trên thang"
        aria-valuetext={current === null ? "Chưa chọn" : String(current)}
        className={`h-8 w-full cursor-pointer accent-brand-600 ${current === null ? "opacity-40" : ""}`}
      />
      <div className="flex justify-between gap-4 text-xs text-faint">
        <span>
          {min}
          {config.minLabel ? ` · ${config.minLabel}` : ""}
        </span>
        <span className="text-right">
          {max}
          {config.maxLabel ? ` · ${config.maxLabel}` : ""}
        </span>
      </div>
      <p className="mt-2 text-sm" aria-live="polite">
        {current === null ? (
          <span className="text-muted">Chạm hoặc kéo trên thanh để chọn.</span>
        ) : (
          <>
            Bạn chọn: <b className="text-base tabular-nums">{current}</b>
          </>
        )}
      </p>
    </div>
  );
}

/** Đề có một chỗ trống: chữ trước + ô gõ + chữ sau trên một dòng. Đáp án là chữ điền vào chỗ trống (cùng dạng `{ text }` với ô soạn thảo). Mọi chữ là text node (React tự thoát HTML). */
function InlineBlankPrompt({ before, after, syllables, value, onChange }: { before: string; after: string; syllables: string[] | null; value: AnswerValue; onChange: (v: AnswerValue) => void }) {
  const text = value && "text" in value ? value.text : "";
  const [sb, sa] = syllables ? sliceByHan(syllables, [before, after]) : [null, null];
  return (
    <p className={`mb-2 text-lg ${syllables ? "han-text ruby-line" : "leading-10"}`} lang={syllables ? "zh-Hans" : undefined} data-testid="inline-blank">
      {sb ? <RubyText text={before} syllables={sb} /> : before}
      <input
        type="text"
        value={text}
        onChange={(e) => onChange({ text: e.target.value })}
        aria-label="Điền vào chỗ trống"
        autoComplete="off"
        spellCheck={false}
        size={Math.max(6, text.length + 2)}
        className="exam-inline-blank"
      />
      {sa ? <RubyText text={after} syllables={sa} /> : after}
    </p>
  );
}
