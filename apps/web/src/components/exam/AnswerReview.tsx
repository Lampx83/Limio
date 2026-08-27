"use client";

import type { ExamAttemptReviewQuestion as QuestionReview } from "@feedbackme/core-lms";
import SafeHtml from "@/components/SafeHtml";
import { plainToRichHtml } from "@/lib/richText";

interface Props {
  questions: QuestionReview[];
}

export default function AnswerReview({ questions }: Props) {
  return (
    <section className="mt-8 space-y-4">
      <h2 className="text-base font-semibold">Xem lại bài làm</h2>
      {questions.map((q, idx) => (
        <QuestionCard key={q.id} q={q} idx={idx} />
      ))}
    </section>
  );
}

function QuestionCard({ q, idx }: { q: QuestionReview; idx: number }) {
  const awarded = q.answer?.score ?? null;
  const correct = awarded !== null && awarded >= q.points;
  const partial = awarded !== null && !correct && awarded > 0;
  const pending = q.answer?.needsGrading ?? false;

  const badge = pending
    ? { label: "Chờ chấm", cls: "bg-amber-100 text-amber-800" }
    : correct
      ? { label: `+${awarded}/${q.points}`, cls: "bg-emerald-100 text-emerald-800" }
      : partial
        ? { label: `${awarded}/${q.points}`, cls: "bg-orange-100 text-orange-800" }
        : { label: `0/${q.points}`, cls: "bg-red-100 text-red-800" };

  return (
    <div className="rounded border border-default bg-white p-4">
      {/* Header */}
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex gap-1 text-sm font-medium leading-snug">
          <span className="text-faint">Câu {idx + 1}.</span>
          <SafeHtml
            html={plainToRichHtml(q.prompt)}
            className="prose prose-sm flex-1 max-w-none dark:prose-invert"
          />
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${badge.cls}`}
        >
          {badge.label}
        </span>
      </div>

      {/* Answer body per type */}
      <div className="mt-2">
        {(q.type === "mcq" || q.type === "multi") && (
          <McqAnswer q={q} />
        )}
        {q.type === "true_false_not_given" && (
          <TfngAnswer q={q} />
        )}
        {q.type === "gap_fill" && (
          <GapFillAnswer q={q} />
        )}
        {(q.type === "essay" || q.type === "short_answer") && (
          <EssayAnswer q={q} />
        )}
      </div>

      {/* Explanation */}
      {q.explanation && (
        <div className="mt-3 rounded bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-900">
          <span className="font-medium">Giải thích: </span>
          {q.explanation}
        </div>
      )}

      {/* Instructor comment */}
      {q.answer?.comment && (
        <div className="mt-2 rounded bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <span className="font-medium">Nhận xét: </span>
          {q.answer.comment}
        </div>
      )}
    </div>
  );
}

// ─── MCQ / MULTI ──────────────────────────────────────────────────────────────

function McqAnswer({ q }: { q: QuestionReview }) {
  const cfg = q.config as {
    options: Array<{ id: string; label?: string; text?: string; isCorrect: boolean }>;
  };
  const ans = q.answer?.answerJson as { optionIds?: string[] } | null;
  const chosen = new Set(ans?.optionIds ?? []);

  return (
    <ul className="space-y-1.5">
      {cfg.options.map((opt) => {
        const picked = chosen.has(opt.id);
        const isCorrect = opt.isCorrect;
        let cls = "border-default text-default";
        let icon = "";
        if (isCorrect && picked) { cls = "border-emerald-400 bg-emerald-50 text-emerald-900"; icon = "✓"; }
        else if (isCorrect && !picked) { cls = "border-emerald-300 bg-emerald-50/50 text-emerald-800"; icon = "✓"; }
        else if (!isCorrect && picked) { cls = "border-red-400 bg-red-50 text-red-900"; icon = "✗"; }
        return (
          <li
            key={opt.id}
            className={`flex items-start gap-2 rounded border px-3 py-1.5 text-sm ${cls}`}
          >
            <span className="w-4 shrink-0 font-bold">{icon}</span>
            <SafeHtml
              html={plainToRichHtml(opt.label ?? opt.text ?? opt.id)}
              className="prose prose-sm max-w-none dark:prose-invert"
            />
            {picked && !isCorrect && (
              <span className="ml-auto shrink-0 text-xs text-red-600">Bạn chọn</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ─── TRUE / FALSE / NOT GIVEN ─────────────────────────────────────────────────

const TFNG_LABELS: Record<string, string> = {
  true: "Đúng",
  false: "Sai",
  not_given: "Không đề cập",
};

function TfngAnswer({ q }: { q: QuestionReview }) {
  const cfg = q.config as { correct: string };
  const ans = q.answer?.answerJson as { correct?: string } | null;
  const chosen = ans?.correct ?? null;
  const options = Object.keys(TFNG_LABELS);

  return (
    <ul className="flex flex-wrap gap-2">
      {options.map((val) => {
        const picked = chosen === val;
        const isCorrect = cfg.correct === val;
        let cls = "border-default text-faint";
        if (isCorrect && picked) cls = "border-emerald-400 bg-emerald-50 text-emerald-900 font-medium";
        else if (isCorrect) cls = "border-emerald-300 bg-emerald-50/50 text-emerald-800";
        else if (picked) cls = "border-red-400 bg-red-50 text-red-900";
        return (
          <li
            key={val}
            className={`rounded border px-4 py-1.5 text-sm ${cls}`}
          >
            {TFNG_LABELS[val]}
            {picked && !isCorrect && <span className="ml-1 text-xs text-red-600">(bạn chọn)</span>}
            {isCorrect && <span className="ml-1 text-xs text-emerald-700">✓</span>}
          </li>
        );
      })}
    </ul>
  );
}

// ─── GAP FILL ─────────────────────────────────────────────────────────────────

function GapFillAnswer({ q }: { q: QuestionReview }) {
  const cfg = q.config as {
    blanks: Array<{ id: string; acceptedAnswers: string[] }>;
  };
  const ans = q.answer?.answerJson as { blanks?: Record<string, string> } | null;
  const submitted = ans?.blanks ?? {};

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-faint">
          <th className="pb-1 pr-4 font-medium">Ô trống</th>
          <th className="pb-1 pr-4 font-medium">Bạn điền</th>
          <th className="pb-1 font-medium">Đáp án đúng</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-default">
        {cfg.blanks.map((b, i) => {
          const userAns = submitted[b.id] ?? "(bỏ trống)";
          const correct = b.acceptedAnswers[0] ?? "";
          const isRight = b.acceptedAnswers.some(
            (a) => a.toLowerCase().trim() === userAns.toLowerCase().trim(),
          );
          return (
            <tr key={b.id}>
              <td className="py-1 pr-4 text-faint">{i + 1}</td>
              <td className={`py-1 pr-4 font-mono ${isRight ? "text-emerald-700" : "text-red-700"}`}>
                {userAns}
              </td>
              <td className="py-1 text-emerald-700 font-mono">{correct}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── ESSAY / SHORT ANSWER ─────────────────────────────────────────────────────

function EssayAnswer({ q }: { q: QuestionReview }) {
  const ans = q.answer?.answerJson as { text?: string } | null;
  const text = ans?.text ?? "";
  return (
    <div>
      {text ? (
        <p className="whitespace-pre-wrap rounded border border-default bg-slate-50 px-3 py-2 text-sm">
          {text}
        </p>
      ) : (
        <p className="italic text-sm text-faint">(không có bài làm)</p>
      )}
    </div>
  );
}
