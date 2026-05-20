"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { apiUrl } from "@/lib/apiUrl";

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

const TYPE_LABEL: Record<QType, string> = {
  mcq: "Chọn nhiều",
  true_false: "Đúng/Sai",
  fill_in: "Điền từ",
  ordering: "Sắp xếp",
  matching: "Ghép cặp",
  numerical: "Số",
  essay: "Tự luận",
  short_answer: "Trả lời ngắn",
};

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
    fetch(apiUrl(`/api/attempts/${attemptId}`))
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

  if (!data) {
    return (
      <div className="card text-center text-sm text-faint">
        <span className="inline-block animate-pulse">Đang tải quiz…</span>
      </div>
    );
  }
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
    await fetch(apiUrl(`/api/attempts/${attemptId}/answers`), {
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
    const res = await fetch(apiUrl(`/api/attempts/${attemptId}/submit`), { method: "POST" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "submit_failed");
      setSubmitting(false);
      return;
    }
    window.location.href = `/learn/${courseSlug}/attempts/${attemptId}/result`;
  }

  const answeredCount = quiz.questions.filter(
    (q) => !isResponseEmpty(q, answers[q.id]?.response ?? null),
  ).length;

  return (
    <div>
      {/* Header */}
      <header>
        <span className="chip-brand">Quiz</span>
        <h1 className="mt-3 h-display text-3xl font-bold sm:text-4xl">
          {quiz.title}
        </h1>
        <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted">
          <span>
            {quiz.questions.length} câu
          </span>
          {quiz.timeLimitSec && (
            <span>{Math.floor(quiz.timeLimitSec / 60)} phút</span>
          )}
          {quiz.requireConfidence && (
            <span>Cần đánh giá độ tự tin</span>
          )}
        </div>

        {/* Progress */}
        <div className="mt-5">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted">Đã trả lời</span>
            <span className="font-semibold tabular-nums">
              {answeredCount}/{quiz.questions.length}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[rgb(var(--surface-muted))]">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-brand-500 to-brand-700 transition-all"
              style={{
                width: `${(answeredCount / Math.max(1, quiz.questions.length)) * 100}%`,
              }}
            />
          </div>
        </div>
      </header>

      <ol className="mt-8 space-y-6">
        {quiz.questions.map((q, qi) => (
          <li key={q.id} className="card">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand-700">
                  {qi + 1}
                </span>
                <span className="chip">{TYPE_LABEL[q.type] ?? q.type}</span>
              </div>
              <span className="text-xs font-medium text-faint">
                {q.points} điểm
              </span>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed">
              {q.prompt}
            </p>

            <div className="mt-4">
              <QuestionInput
                question={q}
                answer={answers[q.id]}
                onChange={(r) => setResponse(q.id, r)}
                onBlur={() => saveAnswer(q)}
              />
            </div>

            {quiz.requireConfidence && (
              <div className="mt-5 flex items-center gap-2 border-t border-token pt-4">
                <span className="text-xs font-medium text-muted">
                  Độ tự tin:
                </span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        setConfidence(q.id, n);
                        setTimeout(() => saveAnswer(q), 0);
                      }}
                      className={`h-8 w-8 rounded-lg text-xs font-semibold transition-all ${
                        answers[q.id]?.confidence === n
                          ? "bg-brand-600 text-white shadow-sm"
                          : "bg-[rgb(var(--surface-muted))] text-muted hover:bg-brand-soft hover:text-brand-700"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-faint">1 = đoán · 5 = chắc chắn</span>
              </div>
            )}
          </li>
        ))}
      </ol>

      {/* Submit bar — sticky */}
      <div className="sticky bottom-4 mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-token bg-[rgb(var(--surface))/0.92] p-3 shadow-card-hover backdrop-blur">
        <p className="text-sm text-muted">
          Đã trả lời{" "}
          <span className="font-semibold text-[rgb(var(--text))]">
            {answeredCount}/{quiz.questions.length}
          </span>{" "}
          câu
        </p>
        <button onClick={onSubmit} disabled={submitting} className="btn-primary btn-lg">
          {submitting ? "Đang nộp..." : "Nộp bài →"}
        </button>
      </div>
      {error && (
        <p className="mt-3 rounded-lg border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700">
          Lỗi: {error}
        </p>
      )}
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
          className="input"
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
          className="textarea"
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
          className="input w-48"
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
        <ul className="space-y-2">
          {question.options.map((opt) => {
            const isSelected = selected.includes(opt.id);
            return (
              <li key={opt.id}>
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all ${
                    isSelected
                      ? "border-brand-500 bg-brand-soft shadow-sm"
                      : "border-token bg-[rgb(var(--surface))] hover:border-brand-200 hover:bg-[rgb(var(--surface-muted))]"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center ${
                      isRadio ? "rounded-full" : "rounded-md"
                    } border-2 transition-colors ${
                      isSelected
                        ? "border-brand-600 bg-brand-600 text-white"
                        : "border-token bg-[rgb(var(--surface))]"
                    }`}
                  >
                    {isSelected && (
                      <span className="text-xs leading-none">{isRadio ? "•" : "✓"}</span>
                    )}
                  </span>
                  <input
                    type={isRadio ? "radio" : "checkbox"}
                    name={`q-${question.id}`}
                    checked={isSelected}
                    onChange={() => toggle(opt.id)}
                    className="sr-only"
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              </li>
            );
          })}
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
  const initial = Array.isArray(answer?.response)
    ? (answer!.response as string[])
    : question.options.map((o) => o.id);
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = ids.indexOf(String(active.id));
    const newIdx = ids.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    onChange(arrayMove(ids, oldIdx, newIdx));
    setTimeout(onBlur, 0);
  }

  return (
    <>
      {/* Mobile: button ↑↓ (tap-select fallback) */}
      <ol className="space-y-2 md:hidden">
        {ids.map((id, i) => (
          <li
            key={id}
            className="flex items-center gap-3 rounded-xl border border-token bg-[rgb(var(--surface))] p-3"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand-700 tabular-nums">
              {i + 1}
            </span>
            <span className="flex-1 text-sm">{optById.get(id)?.label}</span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={i === 0}
                onClick={() => move(i, -1)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-token bg-[rgb(var(--surface))] text-xs transition-colors hover:bg-[rgb(var(--surface-muted))] disabled:opacity-30"
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={i === ids.length - 1}
                onClick={() => move(i, +1)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-token bg-[rgb(var(--surface))] text-xs transition-colors hover:bg-[rgb(var(--surface-muted))] disabled:opacity-30"
                aria-label="Move down"
              >
                ↓
              </button>
            </div>
          </li>
        ))}
      </ol>

      {/* Desktop: horizontal drag-and-drop */}
      <div className="hidden md:block">
        <p className="mb-2 text-xs text-faint">Kéo thả các thẻ theo thứ tự đúng (trái → phải)</p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
            <ol className="flex flex-wrap items-stretch gap-2">
              {ids.map((id, i) => (
                <SortableOrderingItem
                  key={id}
                  id={id}
                  index={i}
                  label={optById.get(id)?.label ?? ""}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      </div>
    </>
  );
}

function SortableOrderingItem({
  id,
  index,
  label,
}: {
  id: string;
  index: number;
  label: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex min-w-[120px] cursor-grab touch-none items-center gap-2 rounded-xl border border-token bg-[rgb(var(--surface))] p-3 shadow-sm transition-shadow hover:shadow active:cursor-grabbing"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand-700 tabular-nums">
        {index + 1}
      </span>
      <span className="text-sm">{label}</span>
    </li>
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
  const rightById = new Map(rights.map((r) => [r.id, r]));

  const pairs = Array.isArray(answer?.response)
    ? (answer!.response as Array<{ leftId: string; rightId: string }>)
    : [];
  const byLeft = new Map(pairs.map((p) => [p.leftId, p.rightId]));
  const usedRights = new Set(byLeft.values());
  const poolRights = rights.filter((r) => !usedRights.has(r.id));

  function commit(next: Map<string, string>) {
    const out: Array<{ leftId: string; rightId: string }> = [];
    for (const left of lefts) {
      const r = next.get(left.id);
      if (r) out.push({ leftId: left.id, rightId: r });
    }
    onChange(out);
    setTimeout(onBlur, 0);
  }

  function pick(leftId: string, rightId: string) {
    const next = new Map(byLeft);
    // If rightId already on another left, remove that mapping first.
    for (const [l, r] of next) {
      if (r === rightId && l !== leftId) next.delete(l);
    }
    next.set(leftId, rightId);
    commit(next);
  }

  function clear(leftId: string) {
    const next = new Map(byLeft);
    next.delete(leftId);
    commit(next);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const rightId = String(active.id).replace(/^right:/, "");
    const overId = String(over.id);
    if (overId === "matching:pool") {
      // Drop back to pool → unassign from whatever left it was on.
      for (const [l, r] of byLeft) {
        if (r === rightId) {
          clear(l);
          return;
        }
      }
      return;
    }
    if (overId.startsWith("left:")) {
      const leftId = overId.slice("left:".length);
      pick(leftId, rightId);
    }
  }

  return (
    <>
      {/* Mobile: dropdown fallback */}
      <ul className="space-y-2 md:hidden">
        {lefts.map((l) => (
          <li
            key={l.id}
            className="flex items-center gap-3 rounded-xl border border-token bg-[rgb(var(--surface))] p-3"
          >
            <span className="flex-1 text-sm font-medium">{l.label}</span>
            <span className="text-faint">→</span>
            <select
              value={byLeft.get(l.id) ?? ""}
              onChange={(e) => pick(l.id, e.target.value)}
              className="select max-w-[220px]"
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

      {/* Desktop: drag from right pool to left slots */}
      <div className="hidden md:block">
        <p className="mb-2 text-xs text-faint">
          Kéo các thẻ bên phải thả vào ô trống tương ứng bên trái
        </p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-2 gap-4">
            <ul className="space-y-2">
              {lefts.map((l) => (
                <MatchingLeftSlot
                  key={l.id}
                  leftId={l.id}
                  leftLabel={l.label}
                  assignedRight={
                    byLeft.has(l.id)
                      ? { id: byLeft.get(l.id)!, label: rightById.get(byLeft.get(l.id)!)?.label ?? "" }
                      : null
                  }
                  onClear={() => clear(l.id)}
                />
              ))}
            </ul>
            <MatchingPool poolRights={poolRights} />
          </div>
        </DndContext>
      </div>
    </>
  );
}

function MatchingLeftSlot({
  leftId,
  leftLabel,
  assignedRight,
  onClear,
}: {
  leftId: string;
  leftLabel: string;
  assignedRight: { id: string; label: string } | null;
  onClear: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `left:${leftId}` });
  return (
    <li className="flex items-center gap-3">
      <span className="flex-1 text-sm font-medium">{leftLabel}</span>
      <span className="text-faint">→</span>
      <div
        ref={setNodeRef}
        className={`flex min-h-[44px] min-w-[180px] items-center justify-between gap-2 rounded-xl border-2 border-dashed p-2 transition-colors ${
          isOver
            ? "border-brand-500 bg-brand-soft"
            : assignedRight
              ? "border-brand-300 bg-[rgb(var(--surface))]"
              : "border-token bg-[rgb(var(--surface-muted))]"
        }`}
      >
        {assignedRight ? (
          <>
            <MatchingDraggable id={assignedRight.id} label={assignedRight.label} compact />
            <button
              type="button"
              onClick={onClear}
              className="text-xs text-faint hover:text-brand-700"
              aria-label="Bỏ chọn"
            >
              ✕
            </button>
          </>
        ) : (
          <span className="text-xs text-faint">— thả vào đây —</span>
        )}
      </div>
    </li>
  );
}

function MatchingPool({
  poolRights,
}: {
  poolRights: Array<{ id: string; label: string }>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "matching:pool" });
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-wrap content-start gap-2 rounded-xl border-2 border-dashed p-3 transition-colors ${
        isOver ? "border-brand-500 bg-brand-soft" : "border-token bg-[rgb(var(--surface-muted))]"
      }`}
    >
      {poolRights.length === 0 ? (
        <span className="text-xs text-faint">Đã ghép hết — kéo thẻ về đây để bỏ chọn</span>
      ) : (
        poolRights.map((r) => <MatchingDraggable key={r.id} id={r.id} label={r.label} />)
      )}
    </div>
  );
}

function MatchingDraggable({
  id,
  label,
  compact = false,
}: {
  id: string;
  label: string;
  compact?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `right:${id}`,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <span
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`inline-flex cursor-grab touch-none items-center rounded-lg border border-token bg-[rgb(var(--surface))] px-3 py-1.5 text-sm shadow-sm transition-shadow hover:shadow active:cursor-grabbing ${
        compact ? "" : ""
      }`}
    >
      {label}
    </span>
  );
}
