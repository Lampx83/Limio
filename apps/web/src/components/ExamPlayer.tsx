"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Megaphone, MessageSquare, Timer, WifiOff } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import PassageView from "./exam/PassageView";
import ExamQuestion, { type AnswerValue } from "./exam/ExamQuestion";
import QuestionPalette from "./exam/QuestionPalette";
import FullscreenGate from "./exam/FullscreenGate";
import TabBlurWarning from "./exam/TabBlurWarning";
import MultiTabDetector from "./exam/MultiTabDetector";
import SubmitReviewModal from "./exam/SubmitReviewModal";

function isAnswered(value: AnswerValue): boolean {
  if (value == null) return false;
  if ("optionIds" in value) return value.optionIds.length > 0;
  if ("correct" in value) return !!value.correct;
  if ("blanks" in value)
    return Object.values(value.blanks).some((v) => typeof v === "string" && v.trim() !== "");
  if ("text" in value) return value.text.trim() !== "";
  return false;
}

interface TiptapDoc {
  type: "doc";
  content: unknown[];
}

interface PassageData {
  id: string;
  title: string;
  contentJson: TiptapDoc;
}

interface QuestionData {
  id: string;
  type: string;
  prompt: string;
  points: number;
  passageId: string | null;
  orderInPassage: number | null;
  orderInExam: number;
  config: Record<string, unknown>;
}

interface ShuffleSnapshot {
  questionOrderByPassage: Record<string, string[]>;
  optionOrderByQuestion: Record<string, string[]>;
}

interface InitialAnswer {
  questionId: string;
  answerJson: unknown;
  answerHash: string | null;
}

interface Props {
  attemptId: string;
  sessionToken: string;
  startedAt: string;
  durationSec: number;
  serverNow: string;
  exam: { id: string; title: string; showResultsAfterSubmit: boolean };
  passages: PassageData[];
  questions: QuestionData[];
  shuffleSnapshot: ShuffleSnapshot;
  initialAnswers: InitialAnswer[];
  // Where to navigate after successful submit. Authenticated learner flow
  // points at /learn/<slug>/...; candidate flow points at /exam-take/<id>/result.
  resultUrl: string;
}

type SaveState = "idle" | "saving" | "saved" | "error" | "stale" | "offline";

const AUTOSAVE_DEBOUNCE_MS = 2_000;
const draftKey = (attemptId: string) => `exam-draft-${attemptId}`;

export default function ExamPlayer(props: Props) {
  const router = useRouter();
  const [sessionToken, setSessionToken] = useState(props.sessionToken);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(() => {
    const m: Record<string, AnswerValue> = {};
    for (const a of props.initialAnswers) m[a.questionId] = a.answerJson as AnswerValue;
    // Restore any draft saved during a prior offline period. Draft wins per-question
    // because it was written more recently than the server snapshot.
    try {
      const raw = localStorage.getItem(draftKey(props.attemptId));
      if (raw) {
        const draft = JSON.parse(raw) as { answers: Record<string, unknown> };
        for (const [qid, val] of Object.entries(draft.answers)) {
          m[qid] = val as AnswerValue;
        }
      }
    } catch { /* storage unavailable — ignore */ }
    return m;
  });
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);

  // Ref mirror of answers — needed in async callbacks to avoid stale closures.
  const answersRef = useRef(answers);
  useEffect(() => { answersRef.current = answers; }, [answers]);

  // questionIds whose latest value is in localStorage but not yet confirmed by server.
  const pendingSync = useRef<Set<string>>(new Set());

  // Server-authoritative remaining: clock skew = serverNow - clientNow at load.
  const clockSkewMs = useMemo(
    () => new Date(props.serverNow).getTime() - Date.now(),
    [props.serverNow],
  );
  const deadlineEpoch = useMemo(
    () => new Date(props.startedAt).getTime() + props.durationSec * 1000,
    [props.startedAt, props.durationSec],
  );
  const [remainingSec, setRemainingSec] = useState(() =>
    Math.max(0, Math.floor((deadlineEpoch - (Date.now() + clockSkewMs)) / 1000)),
  );

  useEffect(() => {
    const t = setInterval(() => {
      const r = Math.max(
        0,
        Math.floor((deadlineEpoch - (Date.now() + clockSkewMs)) / 1000),
      );
      setRemainingSec(r);
      if (r <= 0) {
        clearInterval(t);
        // Auto-submit when timer expires.
        submitAttempt(true).catch(() => undefined);
      }
    }, 1_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadlineEpoch, clockSkewMs]);

  // Build render order from shuffle snapshot.
  const passageQuestionMap = useMemo(() => {
    const m = new Map<string, QuestionData[]>();
    const qById = new Map(props.questions.map((q) => [q.id, q]));
    for (const [key, ids] of Object.entries(props.shuffleSnapshot.questionOrderByPassage)) {
      m.set(
        key,
        ids.map((id) => qById.get(id)).filter((q): q is QuestionData => !!q),
      );
    }
    return m;
  }, [props.questions, props.shuffleSnapshot]);

  const standaloneQuestions = passageQuestionMap.get("standalone") ?? [];

  // Step model: each step is one "page".
  //   passage step → passage + all its questions (split layout)
  //   standalone step → one question per step (single column)
  type Step =
    | { kind: "passage"; passageId: string; passageIndex: number; questionIds: string[] }
    | { kind: "standalone"; questionId: string };
  const steps: Step[] = useMemo(() => {
    const out: Step[] = [];
    props.passages.forEach((p, i) => {
      const qs = passageQuestionMap.get(p.id) ?? [];
      if (qs.length > 0) {
        out.push({
          kind: "passage",
          passageId: p.id,
          passageIndex: i,
          questionIds: qs.map((q) => q.id),
        });
      }
    });
    for (const q of standaloneQuestions) {
      out.push({ kind: "standalone", questionId: q.id });
    }
    return out;
  }, [props.passages, passageQuestionMap, standaloneQuestions]);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Autosave queue — per-question latest-write-wins debounce.
  const pendingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const inflightHash = useRef<Record<string, string>>({});

  const sendSave = useCallback(
    async (questionId: string, answerJson: AnswerValue) => {
      setSaveState("saving");
      try {
        const res = await fetch(
          apiUrl(`/api/exam-attempts/${props.attemptId}/answers/${questionId}`),
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ answerJson, sessionToken }),
          },
        );
        if (res.status === 409) {
          const j = (await res.json().catch(() => null)) as { error?: string } | null;
          if (j?.error === "session_stale") {
            setSaveState("stale");
            return;
          }
          if (j?.error === "attempt_already_submitted") {
            router.replace(props.resultUrl);
            return;
          }
        }
        if (!res.ok) {
          setSaveState("error");
          return;
        }
        const r = (await res.json()) as { answerHash: string; persisted: boolean };
        inflightHash.current[questionId] = r.answerHash;
        pendingSync.current.delete(questionId);
        setSaveState("saved");
      } catch {
        // Network failure — answer is already in localStorage (written by onChange).
        pendingSync.current.add(questionId);
        setSaveState(navigator.onLine ? "error" : "offline");
      }
    },
    [props.attemptId, sessionToken, router],
  );

  // Write the current answer for one question into the localStorage draft.
  const writeDraft = useCallback(
    (questionId: string, value: AnswerValue) => {
      try {
        const raw = localStorage.getItem(draftKey(props.attemptId));
        const draft: { answers: Record<string, unknown>; savedAt: number } = raw
          ? JSON.parse(raw)
          : { answers: {}, savedAt: 0 };
        draft.answers[questionId] = value;
        draft.savedAt = Date.now();
        localStorage.setItem(draftKey(props.attemptId), JSON.stringify(draft));
      } catch { /* storage full or unavailable — ignore */ }
    },
    [props.attemptId],
  );

  const onChange = useCallback(
    (questionId: string, value: AnswerValue) => {
      setAnswers((prev) => ({ ...prev, [questionId]: value }));
      // Always persist locally first — works even if network is down.
      writeDraft(questionId, value);
      pendingSync.current.add(questionId);
      const existing = pendingTimers.current[questionId];
      if (existing) clearTimeout(existing);
      pendingTimers.current[questionId] = setTimeout(() => {
        sendSave(questionId, value);
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [sendSave, writeDraft],
  );

  const claimSession = useCallback(async () => {
    const res = await fetch(apiUrl(`/api/exam-attempts/${props.attemptId}/claim`), {
      method: "POST",
    });
    if (!res.ok) return false;
    const j = (await res.json()) as { sessionToken: string };
    setSessionToken(j.sessionToken);
    setSaveState("idle");
    return true;
  }, [props.attemptId]);

  // A7.7.3 — incident logging (tab blur, paste, fullscreen exit).
  const logIncident = useCallback(
    async (type: string, payload?: Record<string, unknown>) => {
      try {
        await fetch(apiUrl(`/api/exam-attempts/${props.attemptId}/incidents`), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type, payload }),
        });
      } catch {
        // Best-effort. Network loss is itself an incident; we already flag it
        // via the explicit `network_lost` channel.
      }
    },
    [props.attemptId],
  );

  // tab_blur is logged by TabBlurWarning (uses visibilitychange — more reliable
  // than window.blur and avoids double-fire when our own modals open).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData("text") ?? "";
      logIncident("paste", { pastedLength: text.length });
    };
    const onOffline = () => logIncident("network_lost");
    const onFullscreenExit = () => {
      if (!document.fullscreenElement) logIncident("fullscreen_exit");
    };
    window.addEventListener("paste", onPaste, true);
    window.addEventListener("offline", onOffline);
    document.addEventListener("fullscreenchange", onFullscreenExit);
    return () => {
      window.removeEventListener("paste", onPaste, true);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("fullscreenchange", onFullscreenExit);
    };
  }, [logIncident]);

  // Offline resilience — detect connectivity changes and flush pending answers.
  useEffect(() => {
    const onOffline = () => setIsOffline(true);
    const onOnline = async () => {
      setIsOffline(false);
      const toSync = [...pendingSync.current];
      if (toSync.length === 0) return;
      // Flush in parallel; each sendSave removes itself from pendingSync on success.
      await Promise.allSettled(
        toSync.map((qid) => {
          const val = answersRef.current[qid];
          return val !== undefined ? sendSave(qid, val) : Promise.resolve();
        }),
      );
      setJustReconnected(true);
      setTimeout(() => setJustReconnected(false), 3_000);
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [sendSave]);

  // A5.3 — Heartbeat for the instructor live dashboard. Fire-and-forget, 10s.
  useEffect(() => {
    let cancelled = false;
    const ping = () => {
      fetch(apiUrl(`/api/exam-attempts/${props.attemptId}/heartbeat`), {
        method: "POST",
      }).catch(() => {});
    };
    ping();
    const t = setInterval(() => {
      if (!cancelled) ping();
    }, 10_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [props.attemptId]);

  // A5.3.5 — Poll instructor messages every 5s. Toast on new + ack on dismiss.
  const [messages, setMessages] = useState<
    { id: string; kind: string; body: string; sentAt: number }[]
  >([]);
  const lastFetchAtRef = useRef<number>(0);
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const since = lastFetchAtRef.current;
      const url = apiUrl(
        `/api/exam-attempts/${props.attemptId}/messages${since ? `?since=${since}` : ""}`,
      );
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const j = (await res.json()) as {
          messages: {
            id: string;
            kind: string;
            body: string;
            sentAt: number;
            readAt: number | null;
          }[];
        };
        if (cancelled || j.messages.length === 0) return;
        lastFetchAtRef.current = Math.max(
          lastFetchAtRef.current,
          ...j.messages.map((m) => m.sentAt),
        );
        setMessages((prev) => [
          ...prev,
          ...j.messages.filter((nm) => !prev.some((p) => p.id === nm.id)),
        ]);
      } catch {
        /* network blip — heartbeat will recover */
      }
    };
    poll();
    const t = setInterval(poll, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [props.attemptId]);

  const dismissMessage = useCallback(
    async (id: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
      try {
        await fetch(apiUrl(`/api/exam-messages/${id}/read`), {
          method: "PATCH",
        });
      } catch {
        /* ignore */
      }
    },
    [],
  );

  const submitAttempt = useCallback(
    async (auto = false) => {
      if (submitting) return;
      setSubmitting(true);
      try {
        // Flush any pending debounced saves first.
        for (const [qid, timer] of Object.entries(pendingTimers.current)) {
          clearTimeout(timer);
          await sendSave(qid, answers[qid] ?? null);
        }
        const res = await fetch(
          apiUrl(`/api/exam-attempts/${props.attemptId}/submit`),
          { method: "POST" },
        );
        if (!res.ok && !auto) {
          const j = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(j?.error ?? "submit_failed");
          setSubmitting(false);
          return;
        }
        // Clear localStorage for this attempt (A7.4.6).
        localStorage.removeItem(draftKey(props.attemptId));
        for (const p of props.passages) {
          localStorage.removeItem(`exam:${props.attemptId}:passage:${p.id}`);
        }
        router.replace(props.resultUrl);
      } catch {
        setError("network_error");
        setSubmitting(false);
      }
    },
    [
      submitting,
      sendSave,
      answers,
      props.attemptId,
      props.passages,
      props.resultUrl,
      router,
    ],
  );

  const minutes = Math.floor(remainingSec / 60);
  const seconds = remainingSec % 60;
  const timerDanger = remainingSec < 300;

  const optionOrder = props.shuffleSnapshot.optionOrderByQuestion;

  // Build palette items in display order, with continuous numbering across
  // passages + standalone (1..N). Each item knows which step contains it.
  const paletteItems = useMemo(() => {
    const items: Array<{
      questionId: string;
      displayNumber: number;
      group: string;
      groupLabel: string;
      answered: boolean;
      active: boolean;
      stepIndex: number;
    }> = [];
    let n = 1;
    steps.forEach((step, stepIndex) => {
      if (step.kind === "passage") {
        for (const qid of step.questionIds) {
          items.push({
            questionId: qid,
            displayNumber: n++,
            group: `passage:${step.passageId}`,
            groupLabel: `Phần ${step.passageIndex + 1}`,
            answered: isAnswered(answers[qid] ?? null),
            active: stepIndex === currentStepIndex,
            stepIndex,
          });
        }
      } else {
        items.push({
          questionId: step.questionId,
          displayNumber: n++,
          group: "standalone",
          groupLabel: "Câu độc lập",
          answered: isAnswered(answers[step.questionId] ?? null),
          active: stepIndex === currentStepIndex,
          stepIndex,
        });
      }
    });
    return items;
  }, [steps, answers, currentStepIndex]);

  const jumpToQuestion = useCallback(
    (questionId: string) => {
      const target = paletteItems.find((i) => i.questionId === questionId);
      if (!target) return;
      setCurrentStepIndex(target.stepIndex);
      // Scroll question into view (relevant for passage steps with multiple Qs).
      setTimeout(() => {
        document
          .getElementById(`exam-q-${questionId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    },
    [paletteItems],
  );

  const renderQuestion = (q: QuestionData, displayIdx: number) => {
    const num =
      paletteItems.find((it) => it.questionId === q.id)?.displayNumber ?? displayIdx + 1;
    return (
      <div id={`exam-q-${q.id}`} key={q.id} className="scroll-mt-48 border-b border-default py-4">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-medium">
            Câu {num} <span className="text-faint">({q.points} điểm)</span>
          </h3>
          {isAnswered(answers[q.id] ?? null) && (
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
              Đã trả lời
            </span>
          )}
        </div>
        <ExamQuestion
          question={q}
          value={answers[q.id] ?? null}
          onChange={(v) => onChange(q.id, v)}
          optionOrder={optionOrder[q.id]}
        />
      </div>
    );
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <FullscreenGate
        examTitle={props.exam.title}
        onEnter={() => undefined}
        required
      />
      <TabBlurWarning onBlur={() => logIncident("tab_blur")} />
      <MultiTabDetector
        attemptId={props.attemptId}
        onConflict={(peerTabId) => logIncident("multi_tab", { peerTabId })}
      />

      {messages.length > 0 && (
        <div
          data-testid="instructor-message-stack"
          className="fixed right-4 top-4 z-50 flex w-80 flex-col gap-2"
        >
          {messages.map((m) => (
            <div
              key={m.id}
              role="alert"
              className={`rounded-lg border-l-4 bg-white p-3 shadow-lg ${
                m.kind === "broadcast"
                  ? "border-amber-500"
                  : "border-blue-500"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {m.kind === "broadcast"
                    ? <><Megaphone className="h-3.5 w-3.5 shrink-0" /> Thông báo chung</>
                    : <><MessageSquare className="h-3.5 w-3.5 shrink-0" /> Tin nhắn từ giám thị</>}
                </div>
                <button
                  onClick={() => dismissMessage(m.id)}
                  className="text-xs text-slate-400 hover:text-slate-700"
                  aria-label="Đóng"
                >
                  ✕
                </button>
              </div>
              <div className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
                {m.body}
              </div>
            </div>
          ))}
        </div>
      )}

      {isOffline && (
        <div
          role="alert"
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 flex items-center rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 shadow-lg"
        >
          <WifiOff className="mr-2 h-4 w-4 shrink-0" /> Mất kết nối — bài làm đang được lưu tạm trên máy, sẽ tự đồng bộ khi có mạng.
        </div>
      )}
      {justReconnected && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 flex items-center rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900 shadow-lg"
        >
          <CheckCircle className="mr-2 h-4 w-4 shrink-0" /> Đã kết nối lại — đồng bộ bài làm xong.
        </div>
      )}

      <SubmitReviewModal
        open={reviewOpen}
        items={paletteItems}
        submitting={submitting}
        onCancel={() => setReviewOpen(false)}
        onConfirm={() => {
          setReviewOpen(false);
          submitAttempt(false);
        }}
        onJump={jumpToQuestion}
      />
      {/* Sticky header strip — palette + timer + submit always visible. */}
      <div className="sticky top-0 z-30 -mx-4 mb-4 border-b border-default bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold leading-tight">{props.exam.title}</h1>
            <p className="text-xs text-faint">
              Trạng thái lưu: <SaveBadge state={saveState} />
              {saveState === "stale" && (
                <button
                  type="button"
                  onClick={claimSession}
                  className="ml-2 text-blue-600 underline"
                >
                  Tiếp tục trên thiết bị này
                </button>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`rounded px-3 py-1 text-lg font-mono tabular-nums ${timerDanger ? "bg-red-100 text-red-800 ring-2 ring-red-300" : "bg-slate-100 text-slate-900"}`}
              aria-label="Thời gian còn lại"
              title="Thời gian còn lại"
            >
              <Timer className="mr-1 h-4 w-4 shrink-0" />{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </span>
            <button
              type="button"
              onClick={() => setReviewOpen(true)}
              disabled={submitting}
              className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {submitting ? "Đang nộp…" : "Nộp bài"}
            </button>
          </div>
        </header>
        <QuestionPalette items={paletteItems} onJump={jumpToQuestion} />
      </div>

      {error && (
        <div className="mb-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          Lỗi: {error}
        </div>
      )}

      {renderStep(steps[currentStepIndex])}

      <StepNav
        current={currentStepIndex}
        total={steps.length}
        onPrev={() => setCurrentStepIndex((i) => Math.max(0, i - 1))}
        onNext={() => setCurrentStepIndex((i) => Math.min(steps.length - 1, i + 1))}
        onSubmit={() => setReviewOpen(true)}
        unansweredCount={paletteItems.filter((p) => !p.answered).length}
        submitting={submitting}
      />
    </main>
  );

  function renderStep(step: Step | undefined) {
    if (!step) {
      return (
        <section className="rounded border border-default bg-white p-6 text-center text-sm text-faint">
          Không có câu hỏi nào để hiển thị.
        </section>
      );
    }
    if (step.kind === "passage") {
      const passage = props.passages.find((p) => p.id === step.passageId)!;
      const qs = step.questionIds
        .map((qid) => props.questions.find((q) => q.id === qid))
        .filter((q): q is QuestionData => !!q);
      return (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <section className="lg:sticky lg:top-[12rem] lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto rounded border border-default bg-white p-4">
            <PassageView passage={passage} attemptId={props.attemptId} />
          </section>
          <section className="rounded border border-default bg-white p-4">
            <h2 className="mb-2 text-base font-semibold">
              {qs.length} câu hỏi cho đoạn này
            </h2>
            {qs.map((q, i) => renderQuestion(q, i))}
          </section>
        </div>
      );
    }
    // standalone
    const q = props.questions.find((x) => x.id === step.questionId);
    if (!q) return null;
    return (
      <section className="rounded border border-default bg-white p-6">
        {renderQuestion(q, 0)}
      </section>
    );
  }
}

function StepNav({
  current,
  total,
  onPrev,
  onNext,
  onSubmit,
  unansweredCount,
  submitting,
}: {
  current: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onSubmit: () => void;
  unansweredCount: number;
  submitting: boolean;
}) {
  const isFirst = current === 0;
  const isLast = current === total - 1;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded border border-default bg-white px-4 py-3">
      <button
        type="button"
        onClick={onPrev}
        disabled={isFirst}
        className="rounded border border-default px-4 py-1.5 text-sm disabled:opacity-40"
      >
        ← Quay lại
      </button>
      <span className="text-xs text-faint">
        Bước <span className="font-semibold">{current + 1}</span> / {total}
        {isLast && unansweredCount > 0 && (
          <span className="ml-2 text-amber-700">
            ({unansweredCount} câu chưa trả lời)
          </span>
        )}
      </span>
      {isLast ? (
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Đang nộp…" : "Nộp bài"}
        </button>
      ) : (
        <button
          type="button"
          onClick={onNext}
          className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white"
        >
          Tiếp →
        </button>
      )}
    </div>
  );
}

function SaveBadge({ state }: { state: SaveState }) {
  const map: Record<SaveState, { text: string; cls: string }> = {
    idle: { text: "Chưa thay đổi", cls: "text-faint" },
    saving: { text: "Đang lưu…", cls: "text-amber-700" },
    saved: { text: "Đã lưu", cls: "text-emerald-700" },
    error: { text: "Lưu lỗi", cls: "text-red-700" },
    stale: { text: "Phiên đã được mở ở tab khác", cls: "text-red-700" },
    offline: { text: "Lưu tạm — chờ kết nối", cls: "text-amber-700" },
  };
  const v = map[state];
  return <span className={v.cls}>{v.text}</span>;
}
