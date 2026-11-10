"use client";

import { DragDropFillInput, MatchingInput, OrderingInput } from "@/components/quiz/QuestionInputs";
import type { AnswerState, Option, Question } from "@/components/quiz/questionInputTypes";
import { htmlToPlainText } from "@/lib/richText";
import type { AnswerValue } from "./ExamQuestion";

/**
 * Lớp nối giữa ô nhập của Quiz (Sắp xếp, Ghép cặp, Kéo thả điền) và dạng dữ liệu của ĐỀ THI:
 *   cấu hình công khai từ máy chủ (`toPublicQuestionConfig`: mã đã đổi, danh sách đã xáo, không có đáp án)
 *   đáp án lưu: ordering {order:[mã…]}, matching {matched:{mã cặp trái → mã công khai vế phải}}, drag_drop_fill {placed:{ô → mã token}}
 * Chấm điểm đổi mã công khai về mã gốc ở máy chủ (core-lms/exam/public-tokens.ts). Xem docs/tieu-chi/exam-loai-cau-va-dan-anh-doan-van.md, mục C.
 */

interface Item {
  id: string;
  label: string;
}

function items(v: unknown): Item[] {
  return Array.isArray(v)
    ? v.filter((x): x is Item => !!x && typeof x === "object" && typeof (x as Item).id === "string" && typeof (x as Item).label === "string")
    : [];
}

const noop = () => {};

function baseQuestion(type: Question["type"], id: string, prompt: string, options: Option[]): Question {
  return { id, type, prompt, points: 0, orderIndex: 0, options };
}

export function OrderingQuestion({
  questionId,
  config,
  value,
  onChange,
}: {
  questionId: string;
  config: Record<string, unknown>;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
}) {
  const options: Option[] = items(config.items).map((it, i) => ({ id: it.id, label: it.label, orderIndex: i }));
  const answer: AnswerState = { response: value && "order" in value ? value.order : null, confidence: null };
  return (
    <OrderingInput
      question={baseQuestion("ordering", questionId, "", options)}
      answer={answer}
      onChange={(r) => onChange({ order: r as string[] })}
      onBlur={noop}
    />
  );
}

export function MatchingQuestion({
  questionId,
  config,
  value,
  onChange,
}: {
  questionId: string;
  config: Record<string, unknown>;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
}) {
  const options: Option[] = [
    ...items(config.lefts).map((it, i) => ({ id: it.id, label: it.label, orderIndex: i, extra: { side: "left" as const } })),
    ...items(config.rights).map((it, i) => ({ id: it.id, label: it.label, orderIndex: i, extra: { side: "right" as const } })),
  ];
  const matched = value && "matched" in value ? value.matched : {};
  const answer: AnswerState = {
    response: Object.entries(matched).map(([leftId, rightId]) => ({ leftId, rightId })),
    confidence: null,
  };
  return (
    <MatchingInput
      question={baseQuestion("matching", questionId, "", options)}
      answer={answer}
      onChange={(r) => {
        const pairs = r as Array<{ leftId: string; rightId: string }>;
        onChange({ matched: Object.fromEntries(pairs.map((p) => [p.leftId, p.rightId])) });
      }}
      onBlur={noop}
    />
  );
}

export function DragDropFillQuestion({
  questionId,
  prompt,
  config,
  value,
  onChange,
}: {
  questionId: string;
  prompt: string;
  config: Record<string, unknown>;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
}) {
  const options: Option[] = items(config.tokens).map((it, i) => ({ id: it.id, label: it.label, orderIndex: i }));
  const answer: AnswerState = {
    response: { tokens: value && "placed" in value ? value.placed : {} },
    confidence: null,
  };
  return (
    <DragDropFillInput
      // Ô trống [[N]] nằm ngay trong đề; thành phần tự vẽ đề với ô thả (đề có thể là HTML từ trình soạn → lấy chữ thuần).
      question={baseQuestion("drag_drop_fill", questionId, htmlToPlainText(prompt), options)}
      answer={answer}
      onChange={(r) => onChange({ placed: (r as { tokens: Record<string, string> }).tokens })}
      onBlur={noop}
    />
  );
}

export function NumericalQuestion({ value, onChange }: { value: AnswerValue; onChange: (v: AnswerValue) => void }) {
  const raw = value && "value" in value ? String(value.value) : "";
  return (
    <input
      type="text"
      inputMode="decimal"
      value={raw}
      onChange={(e) => onChange({ value: e.target.value })}
      className="input w-48"
      placeholder="Nhập số..."
      aria-label="Đáp án (số)"
    />
  );
}
