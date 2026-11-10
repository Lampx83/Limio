"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Columns2, RotateCcw, Rows2, XCircle } from "lucide-react";
import type { PracticeEmbed, PracticeResult } from "@feedbackme/core-lms";
import { apiUrl } from "@/lib/apiUrl";
import {
  buildSteps,
  countProgress,
  progressLabel,
  readLayoutPref,
  stepIndexOf,
  summaryRows,
  writeLayoutPref,
  type LayoutPref,
} from "@/lib/lessonPracticeView";
import ExamQuestion, { type AnswerValue } from "@/components/exam/ExamQuestion";
import PassageView from "@/components/exam/PassageView";
import { QuestionCard } from "@/components/exam/AnswerReview";

interface CheckResult {
  isCorrect: boolean | null;
  score: number | null;
  maxScore: number;
  manual: boolean;
  config: unknown;
}

type SaveState = "idle" | "saving" | "saved" | "error";

const err = {
  save: "Chưa lưu được một câu trả lời. Hãy kiểm tra mạng, bài làm vẫn còn trên màn hình.",
  check: "Không kiểm tra được. Vui lòng thử lại.",
  start: "Chưa bắt đầu được bài luyện. Vui lòng thử lại.",
};

/** Giải thích của giảng viên nằm trong `config.explanation` (chữ thuần). */
function explanationOf(config: unknown): string | null {
  const e = (config as { explanation?: unknown } | null)?.explanation;
  return typeof e === "string" && e.trim() ? e.trim() : null;
}

/**
 * LANG đợt 3b — khối "Bài luyện" nhúng trong bài học (Figma "Chi tiết bài học"). Dùng bộ máy luyện đề sẵn có
 * (buổi luyện, tự lưu, kiểm tra từng câu) nhưng với vỏ giao diện Language và không chuyển trang. Buổi luyện chỉ được
 * tạo khi học viên chọn đáp án đầu tiên. Chỉ import ExamQuestion/PassageView/QuestionCard, không sửa chúng.
 */
/**
 * Câu đã có đáp án chưa (giống PracticePlayer). Viết riêng ở đây để Bài luyện không phụ thuộc thay đổi dở của màn hình làm
 * bài; khi các dạng câu mới (sắp xếp, ghép cặp…) vào ExamQuestion thì chuyển sang dùng chung hàm ở đó.
 */
function isAnswered(v: AnswerValue): boolean {
  if (v == null) return false;
  if ("optionIds" in v) return v.optionIds.length > 0;
  if ("correct" in v) return !!v.correct;
  if ("blanks" in v) return Object.values(v.blanks).some((x) => typeof x === "string" && x.trim() !== "");
  if ("text" in v) return v.text.trim() !== "";
  return false;
}

export default function LessonPractice({
  slug,
  embed,
  blockTitle,
  lessonId,
  preview = false,
}: {
  slug: string;
  embed: PracticeEmbed;
  blockTitle?: string;
  lessonId?: string;
  /** Xem trước của giảng viên: chấm như học viên nhưng không tạo buổi luyện, không lưu đáp án, không ghi sự kiện. */
  preview?: boolean;
}) {
  const { questions, passages } = embed;
  const steps = useMemo(() => buildSteps(questions), [questions]);
  const numberOf = useMemo(() => new Map(questions.map((q, i) => [q.id, i + 1])), [questions]);
  const qById = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const hasPassage = passages.length > 0;

  const [sessionId, setSessionId] = useState<string | null>(embed.sessionId);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(() =>
    Object.fromEntries(embed.answers.map((a) => [a.questionId, a.answerJson as AnswerValue])),
  );
  const [checks, setChecks] = useState<Record<string, CheckResult>>({});
  // Câu đã kiểm tra ở lần mở trước: kết quả không được lưu phía trình duyệt, nên nạp lại từ máy chủ khi mở bài.
  const [restoring, setRestoring] = useState<Set<string>>(() => new Set(embed.answers.filter((a) => a.checked).map((a) => a.questionId)));
  const [busyCheck, setBusyCheck] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [layout, setLayout] = useState<LayoutPref>("split");
  const [finishing, setFinishing] = useState(false);
  const [result, setResult] = useState<PracticeResult | null>(null);

  // Gửi kèm bài chứa khối để máy chủ ghi nhận lượt quan sát kỹ năng (kiểm tra liên kết ở máy chủ; không có thì như cũ).
  const checkInit: RequestInit = lessonId
    ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lessonId }) }
    : { method: "POST" };
  const sessionRef = useRef<string | null>(embed.sessionId);
  const startingRef = useRef<Promise<string> | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const answersRef = useRef(answers);
  answersRef.current = answers;

  useEffect(() => {
    setLayout(readLayoutPref(typeof window === "undefined" ? null : window.localStorage));
  }, []);

  function changeLayout(next: LayoutPref) {
    setLayout(next);
    writeLayoutPref(window.localStorage, next);
  }

  /** Tạo buổi luyện nếu chưa có (một lần, kể cả khi hai thao tác chạy song song). */
  const ensureSession = useCallback(async (): Promise<string> => {
    if (preview) return "preview";
    if (sessionRef.current) return sessionRef.current;
    if (!startingRef.current) {
      startingRef.current = (async () => {
        const res = await fetch(apiUrl(`/api/exams/${embed.examId}/practice`), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ all: true }),
        });
        if (!res.ok) throw new Error("start_failed");
        const data = (await res.json()) as { sessionId: string };
        sessionRef.current = data.sessionId;
        setSessionId(data.sessionId);
        return data.sessionId;
      })().finally(() => {
        startingRef.current = null;
      });
    }
    return startingRef.current;
  }, [embed.examId, preview]);

  const save = useCallback(
    async (qid: string, v: AnswerValue) => {
      if (preview) return; // xem trước: không lưu đáp án
      setSaveState("saving");
      try {
        const sid = await ensureSession();
        const res = await fetch(apiUrl(`/api/practice-sessions/${sid}/answers/${qid}`), {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ answerJson: v }),
        });
        if (!res.ok) throw new Error("save_failed");
        setSaveState("saved");
        setError(null);
      } catch {
        setSaveState("error");
        setError(err.save);
      }
    },
    [ensureSession, preview],
  );

  // Nạp lại kết quả của các câu đã kiểm tra từ lần trước (gọi kiểm tra lại là idempotent ở máy chủ).
  useEffect(() => {
    const ids = [...restoring];
    if (ids.length === 0 || !embed.sessionId) return;
    let cancelled = false;
    (async () => {
      for (const qid of ids) {
        try {
          const res = await fetch(apiUrl(`/api/practice-sessions/${embed.sessionId}/check/${qid}`), checkInit);
          if (res.ok && !cancelled) {
            const data = (await res.json().catch(() => null)) as CheckResult | null;
            if (data) setChecks((p) => ({ ...p, [qid]: data }));
          }
        } catch {
          /* câu đó coi như chưa kiểm tra: học viên bấm lại được */
        }
        if (!cancelled) setRestoring((p) => { const n = new Set(p); n.delete(qid); return n; });
      }
    })();
    return () => {
      cancelled = true;
    };
    // Chỉ chạy một lần khi mở bài.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onChange(qid: string, v: AnswerValue) {
    setAnswers((p) => ({ ...p, [qid]: v }));
    setChecks((p) => {
      if (!(qid in p)) return p;
      const { [qid]: _gone, ...rest } = p; // sửa đáp án → phải kiểm tra lại (hành vi của luyện đề)
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
      await save(qid, answersRef.current[qid] ?? null);
      const sid = await ensureSession();
      const res = preview
        ? await fetch(apiUrl(`/api/practice-preview/${embed.examId}/check/${qid}`), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ answerJson: answersRef.current[qid] ?? null }),
          })
        : await fetch(apiUrl(`/api/practice-sessions/${sid}/check/${qid}`), checkInit);
      if (!res.ok) {
        setError(res.status === 409 ? "Hãy trả lời câu này trước khi kiểm tra." : err.check);
        return;
      }
      const data = (await res.json()) as CheckResult;
      setChecks((p) => ({ ...p, [qid]: data }));
    } catch {
      setError(err.check);
    } finally {
      setBusyCheck(null);
    }
  }

  async function finish() {
    const left = questions.filter((q) => !isAnswered(answers[q.id] ?? null)).length;
    if (left > 0 && !window.confirm(`Còn ${left} câu chưa trả lời, sẽ tính là sai trong kết quả. Kết thúc bài luyện?`)) return;
    setFinishing(true);
    setError(null);
    try {
      for (const t of Object.values(timers.current)) clearTimeout(t);
      await Promise.all(Object.entries(answers).filter(([, v]) => isAnswered(v)).map(([qid, v]) => save(qid, v)));
      const sid = await ensureSession();
      const res = await fetch(apiUrl(`/api/practice-sessions/${sid}/complete`), { method: "POST" });
      if (!res.ok) throw new Error("complete_failed");
      setResult((await res.json()) as PracticeResult);
    } catch {
      setError("Không kết thúc được. Vui lòng thử lại.");
    } finally {
      setFinishing(false);
    }
  }

  function restart() {
    sessionRef.current = null;
    setSessionId(null);
    setAnswers({});
    setChecks({});
    setResult(null);
    setStepIdx(0);
    setSaveState("idle");
    setError(null);
  }

  const answeredCount = questions.filter((q) => isAnswered(answers[q.id] ?? null)).length;
  const counts = countProgress(
    questions.map((q) => q.id),
    (id) => isAnswered(answers[id] ?? null),
    (id) => id in checks,
  );
  const step = steps[stepIdx];
  const split = hasPassage && layout === "split" && !!step?.passageId;

  function jumpTo(qid: string) {
    const i = stepIndexOf(steps, qid);
    if (i >= 0) setStepIdx(i);
    setTimeout(() => document.getElementById(`lp-${qid}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
  }

  if (result) {
    const rows = summaryRows(result.bySkill);
    return (
      <section aria-labelledby="lp-summary" className="my-6 rounded-2xl border border-token bg-[rgb(var(--surface))] p-5">
        <h2 id="lp-summary" className="text-h3">
          Kết quả bài luyện
        </h2>
        <ul className="mt-3 space-y-2">
          {rows.map((r) => (
            <li key={r.skill} className="flex items-center justify-between text-sm">
              <span>{r.label}</span>
              <span className="tabular-nums font-semibold">
                {r.correct} / {r.total} câu đúng
              </span>
            </li>
          ))}
        </ul>
        {result.wrong.length > 0 && <p className="text-meta mt-3">{result.wrong.length} câu chưa đúng hoặc chưa làm.</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/learn/${slug}/exams/${embed.examId}/practice/${result.sessionId}/result`} className="btn-ghost btn-sm">
            Xem chi tiết
          </Link>
          <button type="button" onClick={restart} className="btn-primary btn-sm inline-flex items-center gap-1.5">
            <RotateCcw size={14} aria-hidden /> Luyện lại
          </button>
        </div>
      </section>
    );
  }

  const renderQuestion = (qid: string) => {
    const q = qById.get(qid)!;
    const n = numberOf.get(qid) ?? 0;
    const value = answers[qid] ?? null;
    const res = checks[qid];
    const explanation = res ? explanationOf(res.config) : null;
    return (
      <div key={qid} id={`lp-${qid}`} className="rounded-xl border border-token bg-[rgb(var(--surface))] p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-lime-700">Câu {n}</h3>
          {res && !res.manual && (
            <span className={`inline-flex items-center gap-1 text-xs font-semibold ${res.isCorrect ? "text-lime-700" : "text-danger-600"}`}>
              {res.isCorrect ? <CheckCircle2 size={14} aria-hidden /> : <XCircle size={14} aria-hidden />}
              Đã kiểm tra
            </span>
          )}
        </div>
        <ExamQuestion question={q} value={value} onChange={(v) => onChange(qid, v)} />
        {embed.checkEnabled && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void check(qid)}
              disabled={!isAnswered(value) || busyCheck === qid || restoring.has(qid)}
              className="btn-primary btn-sm disabled:opacity-50"
            >
              {busyCheck === qid ? "Đang kiểm tra…" : `Kiểm tra câu ${n}`}
            </button>
            {!res && <span className="text-caption text-muted">Bạn có thể đổi đáp án trước khi kiểm tra.</span>}
          </div>
        )}
        {res && res.manual && (
          <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Câu tự luận không kiểm tra tự động được. Hãy tự đối chiếu với bài mẫu hoặc nhờ giảng viên góp ý.
          </p>
        )}
        {res && !res.manual && (
          <div role="status" className={`mt-3 rounded-lg border p-3 text-sm ${res.isCorrect ? "border-lime-300 bg-lime-50" : "border-red-200 bg-red-50"}`}>
            <div className={`font-semibold ${res.isCorrect ? "text-lime-800" : "text-danger-600"}`}>{res.isCorrect ? "Chính xác" : "Chưa chính xác"}</div>
            {explanation && <p className="mt-1 whitespace-pre-wrap text-[rgb(var(--text))]">{explanation}</p>}
            <details className="mt-2" open={!res.isCorrect} data-testid="lp-answer">
              <summary className="cursor-pointer text-xs font-semibold text-muted">Xem đáp án và bài làm của bạn</summary>
              <div className="mt-2">
                <QuestionCard
                  idx={n - 1}
                  q={{
                    id: q.id,
                    orderInExam: 0,
                    type: q.type,
                    prompt: q.prompt,
                    points: q.points,
                    config: res.config,
                    explanation: null,
                    answer: { answerJson: value, score: res.score, needsGrading: false, comment: null },
                  } as never}
                />
              </div>
            </details>
          </div>
        )}
        {!res && restoring.has(qid) && <p className="text-caption mt-2 text-muted">Đang tải kết quả đã kiểm tra…</p>}
      </div>
    );
  };

  return (
    <section aria-labelledby="lp-title" className="my-6" data-testid="lesson-practice">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="lp-title" className="text-h3">
            {blockTitle || embed.title}
          </h2>
          <p className="text-meta" aria-live="polite">
            {progressLabel(counts)}
          </p>
        </div>
        {hasPassage && (
          <div role="group" aria-label="Bố cục" className="hidden items-center gap-1 lg:flex">
            <button
              type="button"
              aria-pressed={layout === "split"}
              onClick={() => changeLayout("split")}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm ${layout === "split" ? "border-lime-400 bg-lime-50 font-semibold text-lime-800" : "border-token text-muted"}`}
            >
              <Columns2 size={14} aria-hidden /> Chia đôi
            </button>
            <button
              type="button"
              aria-pressed={layout === "single"}
              onClick={() => changeLayout("single")}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm ${layout === "single" ? "border-lime-400 bg-lime-50 font-semibold text-lime-800" : "border-token text-muted"}`}
            >
              <Rows2 size={14} aria-hidden /> Một cột
            </button>
          </div>
        )}
      </div>

      <nav aria-label="Các câu" className="mt-3 flex flex-wrap gap-1.5">
        {questions.map((q) => {
          const n = numberOf.get(q.id)!;
          const state = q.id in checks ? "checked" : isAnswered(answers[q.id] ?? null) ? "chosen" : "none";
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => jumpTo(q.id)}
              aria-label={`Câu ${n}${state === "checked" ? ", đã kiểm tra" : state === "chosen" ? ", đã chọn" : ", chưa trả lời"}`}
              className={`h-8 min-w-8 rounded-lg border px-2 text-sm tabular-nums ${
                state === "checked" ? "border-lime-600 bg-lime-600 text-white" : state === "chosen" ? "border-lime-300 bg-lime-50 text-lime-800" : "border-token text-muted"
              }`}
            >
              {n}
            </button>
          );
        })}
      </nav>

      {error && (
        <div role="alert" className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {step &&
        (step.passageId ? (
          <div className={`mt-4 grid gap-4 ${split ? "lg:grid-cols-[1.1fr_1fr]" : ""}`}>
            <div className="rounded-xl border border-token bg-[rgb(var(--surface))] p-4 lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto" data-testid="lp-passage">
              {(() => {
                const p = passages.find((x) => x.id === step.passageId);
                return p ? <PassageView passage={p as { id: string; title: string; contentJson: { type: "doc"; content: unknown[] } }} attemptId={`lesson-practice-${embed.examId}`} /> : null;
              })()}
            </div>
            <div className="space-y-3">{step.questionIds.map(renderQuestion)}</div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">{step.questionIds.map(renderQuestion)}</div>
        ))}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" disabled={stepIdx === 0} onClick={() => setStepIdx((i) => Math.max(0, i - 1))} className="btn-ghost btn-sm disabled:opacity-50">
            ← Quay lại
          </button>
          <span className="text-caption tabular-nums text-muted">
            Bước {stepIdx + 1} / {steps.length}
          </span>
          <button type="button" disabled={stepIdx >= steps.length - 1} onClick={() => setStepIdx((i) => Math.min(steps.length - 1, i + 1))} className="btn-ghost btn-sm disabled:opacity-50">
            Tiếp →
          </button>
        </div>
        {!preview && (
          <button type="button" onClick={() => void finish()} disabled={finishing} className="btn-primary btn-sm disabled:opacity-50">
            {finishing ? "Đang kết thúc…" : "Kết thúc bài luyện"}
          </button>
        )}
      </div>
      <p className="text-caption mt-2 text-muted" aria-live="polite">
        {preview
          ? `Xem trước: không lưu đáp án · ${answeredCount} / ${questions.length} câu`
          : `${saveState === "error" ? "Chưa lưu được" : "Đã lưu câu trả lời"} · ${answeredCount} / ${questions.length} câu`}
        {preview || sessionId ? "" : answeredCount === 0 ? " (bài luyện bắt đầu khi bạn chọn đáp án đầu tiên)" : ""}
      </p>
    </section>
  );
}
