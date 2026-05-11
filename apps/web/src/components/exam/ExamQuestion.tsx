"use client";

import { useMemo } from "react";

export type AnswerValue =
  | { optionIds: string[] }
  | { correct: "true" | "false" | "notgiven" }
  | { blanks: Record<string, string> }
  | { text: string }
  | null;

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
}

export default function ExamQuestion({ question, value, onChange, optionOrder }: Props) {
  const prompt = <p className="mb-2 whitespace-pre-wrap text-sm">{question.prompt}</p>;
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
        return <EssayInput value={value} onChange={onChange} />;
      default:
        return (
          <p className="text-xs text-red-700">Unsupported question type: {question.type}</p>
        );
    }
  }, [question, value, onChange, optionOrder]);

  return (
    <div>
      {prompt}
      {inner}
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

function EssayInput({
  value,
  onChange,
}: {
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
}) {
  const current = value && "text" in value ? value.text : "";
  return (
    <textarea
      value={current}
      onChange={(e) => onChange({ text: e.target.value })}
      rows={8}
      className="w-full rounded border border-default px-2 py-1 text-sm"
      placeholder="Viết bài làm của bạn ở đây…"
    />
  );
}
