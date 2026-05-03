"use client";

import { useEffect, useState } from "react";

type QType =
  | "mcq"
  | "true_false"
  | "fill_in"
  | "ordering"
  | "matching"
  | "numerical"
  | "essay"
  | "short_answer";

interface Option {
  id: string;
  label: string;
  orderIndex: number;
  extra?: { side?: "left" | "right"; pairKey?: string } | null;
}
interface Question {
  id: string;
  type: QType;
  prompt: string;
  points: number;
  orderIndex: number;
  extra?: Record<string, unknown> | null;
  options: Option[];
}
interface Quiz {
  id: string;
  title: string;
  requireConfidence: boolean;
  timeLimitSec: number | null;
  questions: Question[];
}
interface AttemptData {
  attempt: { id: string; startedAt: string; status: string };
  quiz: Quiz;
  responses: Array<{ questionId: string; response: unknown; confidence: number | null }>;
}

type Response =
  | string[]
  | string
  | number
  | Array<{ leftId: string; rightId: string }>;

interface AnswerState {
  response: Response | null;
  confidence: number | null;
}

export default function QuizPlayer({
  attemptId,
  courseSlug,
}: {
  attemptId: string;
  courseSlug: string;
}) {
  const [data, setData] = useState<AttemptData | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/attempts/${attemptId}`)
      .then((res) => res.json())
      .then((d: AttemptData) => {
        setData(d);
        const init: Record<string, AnswerState> = {};
        for (const r of d.responses) {
          init[r.questionId] = {
            response: (r.response as Response) ?? null,
            confidence: r.confidence,
          };
        }
        setAnswers(init);
      });
  }, [attemptId]);

  if (!data) return <p className="text-slate-500">Đang tải...</p>;
  const { quiz } = data;

  function setResponse(qId: string, response: Response) {
    setAnswers((a) => ({
      ...a,
      [qId]: { response, confidence: a[qId]?.confidence ?? null },
    }));
  }
  function setConfidence(qId: string, confidence: number) {
    setAnswers((a) => ({
      ...a,
      [qId]: { response: a[qId]?.response ?? null, confidence },
    }));
  }

  function isResponseEmpty(question: Question, response: Response | null): boolean {
    if (response === null || response === undefined) return true;
    switch (question.type) {
      case "fill_in":
      case "essay":
      case "short_answer":
        return typeof response !== "string" || response.trim() === "";
      case "numerical":
        return typeof response !== "number" || !Number.isFinite(response);
      case "matching":
        return !Array.isArray(response) || response.length === 0;
      default:
        return !Array.isArray(response) || response.length === 0;
    }
  }

  async function saveAnswer(question: Question) {
    const a = answers[question.id];
    if (!a) return;
    if (isResponseEmpty(question, a.response)) return;
    if (quiz.requireConfidence && a.confidence === null) return;
    await fetch(`/api/attempts/${attemptId}/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId: question.id,
        response: a.response,
        confidence: a.confidence ?? undefined,
      }),
    });
  }

  async function onSubmit() {
    setSubmitting(true);
    setError(null);
    for (const q of quiz.questions) {
      await saveAnswer(q);
    }
    const res = await fetch(`/api/attempts/${attemptId}/submit`, { method: "POST" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "submit_failed");
      setSubmitting(false);
      return;
    }
    window.location.href = `/learn/${courseSlug}/attempts/${attemptId}/result`;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold">{quiz.title}</h1>
      {quiz.timeLimitSec && (
        <p className="mt-1 text-sm text-slate-500">
          Thời gian: {Math.floor(quiz.timeLimitSec / 60)} phút
        </p>
      )}

      <ol className="mt-8 space-y-8">
        {quiz.questions.map((q, qi) => (
          <li
            key={q.id}
            className="rounded-lg border border-slate-200 p-5 dark:border-slate-800"
          >
            <p className="text-sm font-medium text-slate-500">
              Câu {qi + 1} · {q.points} điểm · {q.type}
            </p>
            <p className="mt-1 whitespace-pre-wrap">{q.prompt}</p>

            <QuestionInput
              question={q}
              answer={answers[q.id]}
              onChange={(r) => setResponse(q.id, r)}
              onBlur={() => saveAnswer(q)}
            />

            {quiz.requireConfidence && (
              <div className="mt-4 flex items-center gap-2">
                <span className="text-xs text-slate-500">Độ tự tin:</span>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setConfidence(q.id, n);
                      setTimeout(() => saveAnswer(q), 0);
                    }}
                    className={`h-7 w-7 rounded text-xs ${
                      answers[q.id]?.confidence === n
                        ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                        : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>

      <div className="mt-8">
        <button
          onClick={onSubmit}
          disabled={submitting}
          className="rounded bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {submitting ? "Đang nộp..." : "Nộp bài"}
        </button>
        {error && <p className="mt-3 text-sm text-red-600">Lỗi: {error}</p>}
      </div>
    </div>
  );
}

function QuestionInput({
  question,
  answer,
  onChange,
  onBlur,
}: {
  question: Question;
  answer: AnswerState | undefined;
  onChange: (r: Response) => void;
  onBlur: () => void;
}) {
  switch (question.type) {
    case "fill_in":
    case "short_answer":
      return (
        <input
          type="text"
          value={typeof answer?.response === "string" ? answer.response : ""}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="mt-3 w-full rounded border border-slate-300 px-3 py-2 dark:bg-slate-900 dark:border-slate-700"
          placeholder="Nhập đáp án của bạn..."
        />
      );

    case "essay":
      return (
        <textarea
          value={typeof answer?.response === "string" ? answer.response : ""}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          rows={6}
          className="mt-3 w-full rounded border border-slate-300 px-3 py-2 dark:bg-slate-900 dark:border-slate-700"
          placeholder="Viết câu trả lời của bạn..."
        />
      );

    case "numerical":
      return (
        <input
          type="number"
          step="any"
          value={typeof answer?.response === "number" ? answer.response : ""}
          onChange={(e) => {
            const n = Number(e.target.value);
            onChange(Number.isFinite(n) ? n : 0);
          }}
          onBlur={onBlur}
          className="mt-3 w-48 rounded border border-slate-300 px-3 py-2 dark:bg-slate-900 dark:border-slate-700"
          placeholder="Nhập số..."
        />
      );

    case "ordering":
      return <OrderingInput question={question} answer={answer} onChange={onChange} onBlur={onBlur} />;

    case "matching":
      return <MatchingInput question={question} answer={answer} onChange={onChange} onBlur={onBlur} />;

    case "mcq":
    case "true_false":
    default: {
      const selected = Array.isArray(answer?.response)
        ? (answer!.response as string[])
        : [];
      function toggle(optId: string) {
        if (question.type === "true_false") {
          onChange([optId]);
        } else {
          const next = selected.includes(optId)
            ? selected.filter((x) => x !== optId)
            : [...selected, optId];
          onChange(next);
        }
        setTimeout(onBlur, 0);
      }
      const isRadio = question.type === "true_false";
      return (
        <ul className="mt-3 space-y-2">
          {question.options.map((opt) => (
            <li key={opt.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded border border-slate-200 px-3 py-2 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900">
                <input
                  type={isRadio ? "radio" : "checkbox"}
                  name={`q-${question.id}`}
                  checked={selected.includes(opt.id)}
                  onChange={() => toggle(opt.id)}
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            </li>
          ))}
        </ul>
      );
    }
  }
}

function OrderingInput({
  question,
  answer,
  onChange,
  onBlur,
}: {
  question: Question;
  answer: AnswerState | undefined;
  onChange: (r: Response) => void;
  onBlur: () => void;
}) {
  // Initialize order: use existing response if any, else show options in
  // shuffled-ish display order (orderIndex). Learner uses up/down arrows.
  const initial = Array.isArray(answer?.response)
    ? (answer!.response as string[])
    : question.options.map((o) => o.id);
  // Validate that all referenced ids exist; otherwise fall back.
  const ids = initial.every((id) => question.options.find((o) => o.id === id))
    ? initial
    : question.options.map((o) => o.id);
  const optById = new Map(question.options.map((o) => [o.id, o]));

  function move(idx: number, delta: number) {
    const next = [...ids];
    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= next.length) return;
    [next[idx], next[newIdx]] = [next[newIdx]!, next[idx]!];
    onChange(next);
    setTimeout(onBlur, 0);
  }

  return (
    <ol className="mt-3 space-y-1">
      {ids.map((id, i) => (
        <li
          key={id}
          className="flex items-center gap-2 rounded border border-slate-200 px-3 py-2 dark:border-slate-800"
        >
          <span className="font-mono text-xs text-slate-500">{i + 1}.</span>
          <span className="flex-1 text-sm">{optById.get(id)?.label}</span>
          <button
            type="button"
            disabled={i === 0}
            onClick={() => move(i, -1)}
            className="rounded border border-slate-300 px-1.5 text-xs disabled:opacity-30 dark:border-slate-700"
          >
            ↑
          </button>
          <button
            type="button"
            disabled={i === ids.length - 1}
            onClick={() => move(i, +1)}
            className="rounded border border-slate-300 px-1.5 text-xs disabled:opacity-30 dark:border-slate-700"
          >
            ↓
          </button>
        </li>
      ))}
    </ol>
  );
}

function MatchingInput({
  question,
  answer,
  onChange,
  onBlur,
}: {
  question: Question;
  answer: AnswerState | undefined;
  onChange: (r: Response) => void;
  onBlur: () => void;
}) {
  const lefts = question.options.filter((o) => o.extra?.side === "left");
  const rights = question.options.filter((o) => o.extra?.side === "right");

  const pairs = Array.isArray(answer?.response)
    ? (answer!.response as Array<{ leftId: string; rightId: string }>)
    : [];
  const byLeft = new Map(pairs.map((p) => [p.leftId, p.rightId]));

  function pick(leftId: string, rightId: string) {
    const next: Array<{ leftId: string; rightId: string }> = [];
    for (const left of lefts) {
      const r = left.id === leftId ? rightId : byLeft.get(left.id);
      if (r) next.push({ leftId: left.id, rightId: r });
    }
    onChange(next);
    setTimeout(onBlur, 0);
  }

  return (
    <ul className="mt-3 space-y-2">
      {lefts.map((l) => (
        <li
          key={l.id}
          className="flex items-center gap-3 rounded border border-slate-200 px-3 py-2 dark:border-slate-800"
        >
          <span className="flex-1 text-sm">{l.label}</span>
          <span className="text-slate-400">→</span>
          <select
            value={byLeft.get(l.id) ?? ""}
            onChange={(e) => pick(l.id, e.target.value)}
            className="rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">— chọn —</option>
            {rights.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </li>
      ))}
    </ul>
  );
}
