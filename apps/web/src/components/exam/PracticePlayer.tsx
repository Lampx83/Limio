"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";
import PassageView from "./PassageView";
import ExamQuestion, { type AnswerValue } from "./ExamQuestion";
import { QuestionCard } from "./AnswerReview";
import { formatClock } from "@/lib/audioClock";

interface PQuestion {
  id: string;
  type: string;
  prompt: string;
  points: number;
  passageId: string | null;
  sectionTitle: string;
  languageSkill: string | null;
  config: Record<string, unknown>;
}
interface PPassage {
  id: string;
  title: string;
  contentJson: { type: "doc"; content: unknown[] };
}
interface PAnswer {
  questionId: string;
  answerJson: unknown;
  checked: boolean;
  isCorrect: boolean | null;
}
interface CheckResult {
  isCorrect: boolean | null;
  score: number | null;
  maxScore: number;
  manual: boolean;
  config: unknown;
}

function isAnswered(v: AnswerValue): boolean {
  if (v == null) return false;
  if ("optionIds" in v) return v.optionIds.length > 0;
  if ("correct" in v) return !!v.correct;
  if ("blanks" in v) return Object.values(v.blanks).some((x) => typeof x === "string" && x.trim() !== "");
  if ("text" in v) return v.text.trim() !== "";
  return false;
}

type Step = { key: string; passageId: string | null; questionIds: string[] };

/**
 * LANG G5e — làm bài ở chế độ LUYỆN ĐỀ: không ép giờ, quay lại tự do, "Kiểm tra" từng câu để thấy
 * đúng/sai và đáp án đúng ngay. Khác phòng thi thử: có khung hệ thống (không phải phòng thi), bài nghe
 * phát tự do (không giới hạn lượt).
 */
export default function PracticePlayer({
  slug,
  examId,
  sessionId,
  checkEnabled,
  timed,
  startedAt,
  questions,
  passages,
  initialAnswers,
}: {
  slug: string;
  examId: string;
  sessionId: string;
  checkEnabled: boolean;
  timed: boolean;
  startedAt: string;
  questions: PQuestion[];
  passages: PPassage[];
  initialAnswers: PAnswer[];
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(() =>
    Object.fromEntries(initialAnswers.map((a) => [a.questionId, a.answerJson as AnswerValue])),
  );
  const [checks, setChecks] = useState<Record<string, CheckResult>>({});
  const [busyCheck, setBusyCheck] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (!timed) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [timed]);

  const steps: Step[] = useMemo(() => {
    const out: Step[] = [];
    for (const q of questions) {
      const last = out[out.length - 1];
      if (q.passageId && last && last.passageId === q.passageId) last.questionIds.push(q.id);
      else out.push({ key: `${q.passageId ?? "q"}:${q.id}`, passageId: q.passageId, questionIds: [q.id] });
    }
    return out;
  }, [questions]);
  const [stepIdx, setStepIdx] = useState(0);
  const qById = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const numberOf = useMemo(() => new Map(questions.map((q, i) => [q.id, i + 1])), [questions]);
  const answeredCount = questions.filter((q) => isAnswered(answers[q.id] ?? null)).length;
  const step = steps[stepIdx];

  async function save(qid: string, v: AnswerValue) {
    try {
      const res = await fetch(apiUrl(`/api/practice-sessions/${sessionId}/answers/${qid}`), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answerJson: v }),
      });
      if (!res.ok) setError("Chưa lưu được một câu trả lời. Kiểm tra mạng — bạn có thể bấm Kiểm tra để thử lại.");
      else setError(null);
    } catch {
      setError("Chưa lưu được một câu trả lời. Kiểm tra mạng.");
    }
  }

  function onChange(qid: string, v: AnswerValue) {
    setAnswers((p) => ({ ...p, [qid]: v }));
    setChecks((p) => {
      if (!(qid in p)) return p;
      const { [qid]: _gone, ...rest } = p; // sửa đáp án → phải kiểm tra lại
      return rest;
    });
    clearTimeout(timers.current[qid]);
    timers.current[qid] = setTimeout(() => void save(qid, v), 500);
  }

  async function check(qid: string) {
    setBusyCheck(qid);
    setError(null);
    try {
      clearTimeout(timers.current[qid]);
      await save(qid, answers[qid] ?? null);
      const res = await fetch(apiUrl(`/api/practice-sessions/${sessionId}/check/${qid}`), { method: "POST" });
      if (!res.ok) {
        setError(res.status === 409 ? "Hãy trả lời câu này trước khi kiểm tra." : "Không kiểm tra được. Vui lòng thử lại.");
        return;
      }
      const data = (await res.json()) as CheckResult;
      setChecks((p) => ({ ...p, [qid]: data }));
    } catch {
      setError("Không kiểm tra được. Kiểm tra mạng rồi thử lại.");
    } finally {
      setBusyCheck(null);
    }
  }

  async function finish() {
    const left = questions.length - answeredCount;
    if (left > 0 && !window.confirm(`Còn ${left} câu chưa trả lời, sẽ tính là sai trong kết quả. Kết thúc buổi luyện?`)) return;
    setFinishing(true);
    setError(null);
    try {
      for (const t of Object.values(timers.current)) clearTimeout(t);
      await Promise.all(Object.entries(answers).filter(([, v]) => isAnswered(v)).map(([qid, v]) => save(qid, v)));
      const res = await fetch(apiUrl(`/api/practice-sessions/${sessionId}/complete`), { method: "POST" });
      if (!res.ok) throw new Error("complete_failed");
      router.push(`/learn/${slug}/exams/${examId}/practice/${sessionId}/result`);
    } catch {
      setError("Không kết thúc được. Vui lòng thử lại.");
      setFinishing(false);
    }
  }

  const renderQuestion = (q: PQuestion) => {
    const value = answers[q.id] ?? null;
    const res = checks[q.id];
    return (
      <div key={q.id} className="border-b border-default py-4" id={`pq-${q.id}`}>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-medium">
            Câu {numberOf.get(q.id)} <span className="text-faint">({q.points} điểm)</span>
          </h3>
          {res && !res.manual && (
            <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${res.isCorrect ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
              {res.isCorrect ? "Đúng" : "Chưa đúng"}
            </span>
          )}
        </div>
        <ExamQuestion question={q} value={value} onChange={(v) => onChange(q.id, v)} />
        {checkEnabled && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => void check(q.id)}
              disabled={!isAnswered(value) || busyCheck === q.id}
              className="rounded border border-default px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              {busyCheck === q.id ? "Đang kiểm tra…" : "Kiểm tra"}
            </button>
          </div>
        )}
        {res && res.manual && (
          <p className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Câu tự luận không kiểm tra tự động được. Hãy tự đối chiếu với bài mẫu hoặc nhờ giảng viên góp ý.
          </p>
        )}
        {res && !res.manual && (
          <div className="mt-3">
            <QuestionCard
              idx={(numberOf.get(q.id) ?? 1) - 1}
              q={{
                id: q.id,
                orderInExam: 0,
                type: q.type,
                prompt: q.prompt,
                points: q.points,
                config: res.config,
                explanation: null,
                answer: { answerJson: value, score: res.score, needsGrading: false, comment: null },
              }}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-6" data-testid="practice-player">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold leading-tight">Luyện đề</h1>
          <p className="text-xs text-faint">
            {answeredCount}/{questions.length} câu đã trả lời · bài làm tự lưu ·{" "}
            <Link href={`/learn/${slug}/exams/${examId}/practice`} className="text-blue-600 underline">
              Thoát (làm tiếp sau)
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {timed && (
            <span className="rounded bg-slate-100 px-3 py-1 font-mono text-lg tabular-nums" title="Thời gian đã luyện (chỉ để theo dõi)">
              {formatClock(Math.max(0, (now - new Date(startedAt).getTime()) / 1000))}
            </span>
          )}
          <button type="button" onClick={() => void finish()} disabled={finishing} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">
            {finishing ? "Đang kết thúc…" : "Kết thúc buổi luyện"}
          </button>
        </div>
      </header>

      <nav aria-label="Các câu" className="mb-4 flex flex-wrap gap-1.5">
        {steps.map((s, i) => {
          const done = s.questionIds.every((id) => isAnswered(answers[id] ?? null));
          const first = numberOf.get(s.questionIds[0]!)!;
          const lastN = numberOf.get(s.questionIds[s.questionIds.length - 1]!)!;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setStepIdx(i)}
              aria-current={i === stepIdx ? "step" : undefined}
              className={`rounded border px-2.5 py-1 text-xs tabular-nums ${
                i === stepIdx ? "border-blue-600 bg-blue-50 font-semibold text-blue-800" : done ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-default"
              }`}
            >
              {first === lastN ? first : `${first}–${lastN}`}
            </button>
          );
        })}
      </nav>

      {error && <div role="alert" className="mb-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      {step &&
        (step.passageId ? (
          <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
            <section className="rounded border border-default bg-white p-4 lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto">
              {(() => {
                const p = passages.find((x) => x.id === step.passageId);
                // Luyện đề: KHÔNG truyền `audio` → trình phát gốc, nghe lại tuỳ ý (không giới hạn lượt).
                return p ? <PassageView passage={p} attemptId={`practice-${sessionId}`} /> : null;
              })()}
            </section>
            <section className="rounded border border-default bg-white p-4">
              <h2 className="mb-2 text-base font-semibold">{step.questionIds.length} câu hỏi cho đoạn này</h2>
              {step.questionIds.map((id) => renderQuestion(qById.get(id)!))}
            </section>
          </div>
        ) : (
          <section className="rounded border border-default bg-white p-6">{step.questionIds.map((id) => renderQuestion(qById.get(id)!))}</section>
        ))}

      <div className="mt-4 flex items-center justify-between rounded border border-default bg-white px-4 py-3">
        <button type="button" disabled={stepIdx === 0} onClick={() => setStepIdx((i) => Math.max(0, i - 1))} className="rounded border border-default px-4 py-1.5 text-sm disabled:opacity-40">
          ← Quay lại
        </button>
        <span className="text-xs text-faint">
          Bước {stepIdx + 1} / {steps.length}
        </span>
        <button type="button" disabled={stepIdx >= steps.length - 1} onClick={() => setStepIdx((i) => Math.min(steps.length - 1, i + 1))} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40">
          Tiếp →
        </button>
      </div>
    </main>
  );
}
