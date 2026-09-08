"use client";

import { useEffect, useRef, useState } from "react";
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
import SafeHtml from "@/components/SafeHtml";
import ConfidenceStars from "@/components/quiz/ConfidenceStars";
import { plainToRichHtml, htmlToPlainText } from "@/lib/richText";

type QType =
  | "mcq"
  | "true_false"
  | "fill_in"
  | "ordering"
  | "matching"
  | "numerical"
  | "essay"
  | "short_answer"
  | "drag_drop_fill";

interface Option {
  id: string;
  label: string;
  orderIndex: number;
  extra?: {
    side?: "left" | "right";
    pairKey?: string;
    blankIndex?: number | null;
  } | null;
}
interface Question {
  id: string;
  type: QType;
  prompt: string;
  points: number;
  orderIndex: number;
  extra?: Record<string, unknown> | null;
  options: Option[];
  /** mcq với đúng 1 option đúng → hiện radio thay vì checkbox. Server tính
   *  sẵn (không lộ option nào đúng); mặc định false cho type khác mcq. */
  isSingleAnswer?: boolean;
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
  | Array<{ leftId: string; rightId: string }>
  // drag_drop_fill: map blank index (as string key) → option id placed.
  | { tokens: Record<string, string> };

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
  drag_drop_fill: "Kéo thả",
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
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  /**
   * B12 — thời gian thật của từng câu, cộng dồn theo mili-giây câu đó đang
   * hiện trên màn hình.
   *
   * Phải đo ở đây vì mọi đáp án chỉ được gửi lên một lượt lúc bấm nộp: nhìn từ
   * máy chủ thì cả bài trông như được trả lời cùng một khoảnh khắc. Và người
   * học đi tới đi lui giữa các câu, nên "lúc vào trừ lúc ra" một lần là không
   * đủ — phải cộng dồn từng quãng.
   */
  const latencyRef = useRef<Record<string, number>>({});
  const stepEnteredAtRef = useRef<number>(Date.now());
  const [now, setNow] = useState(() => Date.now());

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

  // Timer tick — chỉ khi quiz có giới hạn thời gian.
  useEffect(() => {
    if (!data?.quiz.timeLimitSec) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [data?.quiz.timeLimitSec]);

  /*
   * Hết giờ thì tự nộp.
   *
   * Trước đây đồng hồ đếm về 00:00 rồi đứng đó, và người học vẫn trả lời tiếp
   * bình thường — nên "giới hạn thời gian" không giới hạn gì cả, chỉ là một
   * con số đỏ. Tệ hơn: mở bài rồi để đó vài tiếng, quay lại vẫn làm được, và
   * điểm vẫn tính.
   *
   * Không hỏi lại ở đây: hết giờ là hết giờ, hỏi thì cũng không ai bấm kịp.
   */
  const autoSubmittedRef = useRef(false);
  useEffect(() => {
    const limit = data?.quiz.timeLimitSec;
    if (!limit || !data) return;
    const startedAt = new Date(data.attempt.startedAt).getTime();
    const remaining = limit - Math.floor((now - startedAt) / 1000);
    if (remaining > 0) return;
    if (autoSubmittedRef.current) return;

    /*
      KHÔNG tự nộp một lượt chưa trả lời câu nào.
 
      Người vào xem thử đề rồi đóng tab cũng tạo ra một lượt làm. Lượt đó quá
      hạn từ lâu, nên lần sau họ mở quiz lên là đồng hồ đã bằng 0 và bản tự nộp
      chốt sổ ngay — ghi cho họ một điểm 0 cho bài họ chưa từng làm. Hôm nay
      chuyện đó xảy ra 16 lần trên lớp thật.
 
      Không trả lời câu nào thì đó là xem thử, không phải làm bài: bỏ lượt đó
      đi và mở một lượt mới, để họ vẫn làm được.
    */
    if (answeredCountNow() === 0) {
      autoSubmittedRef.current = true;
      void restartExpiredAttempt();
      return;
    }

    autoSubmittedRef.current = true;
    void onSubmit({ auto: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, data]);

  // B12 — không tính giờ khi người học rời tab. Cùng lý do như bộ đo thời gian
  // đọc bài: để tab đó rồi đi ăn cơm không phải là đang nghĩ về câu hỏi, và một
  // con số sai vẫn sẽ được đem đi so sánh độ khó giữa các câu.
  // Không có mảng phụ thuộc: phải gắn lại mỗi lượt vẽ để bắt đúng câu đang mở.
  // Thêm/gỡ một listener là rẻ; đọc nhầm câu thì số liệu sai.
  useEffect(() => {
    // `data` chưa về thì `quiz` bên dưới còn chưa khởi tạo — gọi flushLatency
    // lúc này sẽ ném lỗi tham chiếu.
    if (!data) return;
    function onVisibility() {
      if (document.visibilityState === "hidden") flushLatency();
      else stepEnteredAtRef.current = Date.now();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  });

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
      case "drag_drop_fill": {
        // Considered "empty" until at least one blank has a token placed.
        const r = response as { tokens?: Record<string, string> } | unknown;
        const tokens =
          typeof r === "object" && r !== null && "tokens" in r
            ? (r as { tokens: Record<string, string> }).tokens
            : {};
        return Object.values(tokens).filter((v) => !!v).length === 0;
      }
      default:
        return !Array.isArray(response) || response.length === 0;
    }
  }

  /**
   * "Đã trả lời" phải khớp với điều kiện server thật sự chấp nhận — không chỉ
   * có response. Trước đây `requireConfidence` chỉ chặn `saveAnswer` gọi API
   * (im lặng), còn đếm/tô màu/nút Nộp vẫn coi câu đó là xong vì chỉ nhìn
   * `response`. Hậu quả: học viên chọn đáp án, không để ý sao độ tự tin, bấm
   * Nộp không bị cảnh báo — và câu đó chưa từng được lưu, tính như bỏ trống.
   */
  function isAnswerIncomplete(question: Question, answer: AnswerState | undefined): boolean {
    if (isResponseEmpty(question, answer?.response ?? null)) return true;
    if (quiz.requireConfidence && (answer?.confidence ?? null) === null) return true;
    return false;
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
        latencyMs: latencyRef.current[question.id],
      }),
    });
  }

  /** Đếm ngay tại thời điểm gọi — `answeredCount` bên dưới nằm sau early return. */
  function answeredCountNow() {
    const qs = data?.quiz.questions ?? [];
    return qs.filter((q) => !isAnswerIncomplete(q, answers[q.id])).length;
  }

  /**
   * Lượt đã quá hạn mà chưa trả lời gì: bỏ nó, mở lượt mới, ở lại trang.
   *
   * Bỏ hẳn thay vì nộp, vì một lượt 0 điểm cho bài chưa từng làm là dữ liệu
   * sai — nó chui vào điểm số, vào thống kê, và vào cả phản hồi gửi cho người
   * học.
   */
  async function restartExpiredAttempt() {
    try {
      await fetch(apiUrl(`/api/attempts/${attemptId}/abandon`), { method: "POST" });
    } catch {
      // Bỏ được thì tốt; không bỏ được thì vẫn tải lại để lấy lượt mới.
    }
    window.location.reload();
  }

  async function onSubmit(opts?: { auto?: boolean }) {
    // Nộp bài là việc không lùi lại được. Trước đây nút nộp trông y hệt nút
    // "Câu sau" và nằm ngay cạnh, nên một cú bấm nhầm là kết thúc lượt làm bài
    // của người học. Hỏi lại, và nói rõ còn thiếu bao nhiêu câu.
    const missing = (data?.quiz.questions.length ?? 0) - answeredCountNow();
    if (missing > 0 && !opts?.auto) {
      const reason = quiz.requireConfidence
        ? "chưa trả lời hoặc chưa chọn độ tự tin"
        : "chưa trả lời";
      const ok = window.confirm(
        `Bạn còn ${missing} câu ${reason}. Nộp bài bây giờ thì những câu đó tính là bỏ trống và không sửa lại được.\n\nVẫn nộp?`,
      );
      if (!ok) return;
    }

    // Chốt sổ câu đang mở trước khi gửi, nếu không thì đúng câu người học vừa
    // ngồi lâu nhất lại là câu duy nhất không được tính giờ.
    flushLatency();
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
    (q) => !isAnswerIncomplete(q, answers[q.id]),
  ).length;

  // Timer: dùng attempt.startedAt + quiz.timeLimitSec để tính thời gian còn lại.
  // Không auto-submit (khác exam-take) — quiz LMS không cần proctoring.
  const startedAtMs = new Date(data.attempt.startedAt).getTime();
  const remainingSec = quiz.timeLimitSec
    ? Math.max(0, quiz.timeLimitSec - Math.floor((now - startedAtMs) / 1000))
    : null;
  const minutes = remainingSec !== null ? Math.floor(remainingSec / 60) : 0;
  const seconds = remainingSec !== null ? remainingSec % 60 : 0;
  const timerDanger = remainingSec !== null && remainingSec < 60;

  const currentQ = quiz.questions[currentStepIndex];
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === quiz.questions.length - 1;

  /*
   * Màu của nút "Nộp bài" nói lên MỘT điều: đã trả lời hết chưa.
   *
   * Trước đây nút nộp và nút "Câu sau" dùng chung kiểu nền đặc, đặt cạnh nhau,
   * nên màu không còn phân biệt được việc đi tiếp với việc kết thúc — và kết
   * thúc thì không lùi lại được. Giờ trong lúc còn câu bỏ trống, nút nộp là nút
   * viền: vẫn bấm được nếu thật sự muốn, nhưng không tranh chỗ với nút đi tiếp.
   */
  const allAnswered = answeredCount === quiz.questions.length;
  const submitClass = allAnswered ? "btn-primary" : "btn-secondary";

  /** Dồn quãng vừa rồi vào câu đang hiện, rồi đặt lại mốc. */
  function flushLatency() {
    const q = quiz.questions[currentStepIndex];
    if (!q) return;
    const now = Date.now();
    latencyRef.current[q.id] = (latencyRef.current[q.id] ?? 0) + (now - stepEnteredAtRef.current);
    stepEnteredAtRef.current = now;
  }

  function jumpTo(idx: number) {
    const next = Math.max(0, Math.min(quiz.questions.length - 1, idx));
    if (next === currentStepIndex) return;
    flushLatency();
    setCurrentStepIndex(next);
  }

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-6">
      {/* LEFT — question content */}
      <div className="min-w-0">
        {/* Title (mobile only — desktop puts it in right panel) */}
        <header className="mb-4 lg:hidden">
          <h1 className="text-xl font-semibold leading-tight">{quiz.title}</h1>
          <p className="mt-1 text-xs text-faint">
            Đã trả lời{" "}
            <span className="font-semibold text-[rgb(var(--text))]">
              {answeredCount}/{quiz.questions.length}
            </span>
          </p>
        </header>

        {error && (
          <div className="mb-3 rounded border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
            Lỗi: {error}
          </div>
        )}

        {/* Current question */}
        {currentQ && (
          <section className="card">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand-700">
                  {currentStepIndex + 1}
                </span>
                <span className="chip">
                  {currentQ.type === "mcq" && currentQ.isSingleAnswer
                    ? "Chọn 1"
                    : (TYPE_LABEL[currentQ.type] ?? currentQ.type)}
                </span>
              </div>
              <span className="text-xs font-medium text-faint">
                {currentQ.points} điểm
              </span>
            </div>
            {/* drag_drop_fill renders the prompt itself with drop zones in
                place of [[N]] placeholders, so skip the standard SafeHtml. */}
            {currentQ.type !== "drag_drop_fill" && (
              <SafeHtml
                html={plainToRichHtml(currentQ.prompt)}
                className="prose prose-base mt-3 max-w-none leading-relaxed dark:prose-invert"
              />
            )}
            <div className="mt-4">
              <QuestionInput
                question={currentQ}
                answer={answers[currentQ.id]}
                onChange={(r) => setResponse(currentQ.id, r)}
                onBlur={() => saveAnswer(currentQ)}
              />
            </div>
            {quiz.requireConfidence && (
              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-token pt-4">
                <span className="text-sm font-medium text-muted">Độ tự tin:</span>
                <ConfidenceStars
                  value={answers[currentQ.id]?.confidence ?? null}
                  onChange={(n) => {
                    setConfidence(currentQ.id, n);
                    setTimeout(() => saveAnswer(currentQ), 0);
                  }}
                />
                {!isResponseEmpty(currentQ, answers[currentQ.id]?.response ?? null) &&
                  (answers[currentQ.id]?.confidence ?? null) === null && (
                    <p className="banner-warning w-full py-1.5 text-xs">
                      Chưa chọn độ tự tin — câu này chưa được lưu, cần chọn trước khi nộp bài.
                    </p>
                  )}
              </div>
            )}
          </section>
        )}

        {/* Bottom step nav */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-token bg-[rgb(var(--surface))] px-4 py-3">
          <button
            type="button"
            onClick={() => jumpTo(currentStepIndex - 1)}
            disabled={isFirst}
            className="btn-ghost btn-sm disabled:opacity-40"
          >
            ← Câu trước
          </button>
          <span className="text-sm text-muted tabular-nums">
            Câu {currentStepIndex + 1}/{quiz.questions.length}
          </span>
          {isLast ? (
            <button
              type="button"
              onClick={() => onSubmit()}
              disabled={submitting}
              className={`${submitClass} btn-sm`}
            >
              {submitting ? "Đang nộp…" : "Nộp bài"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => jumpTo(currentStepIndex + 1)}
              className="btn-primary btn-sm"
            >
              Câu sau →
            </button>
          )}
        </div>
      </div>

      {/* RIGHT — sticky info panel (desktop only) */}
      <aside className="hidden lg:block">
        <div className="sticky top-20 space-y-4 rounded-2xl border border-token bg-[rgb(var(--surface))] p-4 shadow-sm">
          <div>
            <h1 className="text-base font-semibold leading-snug">
              {quiz.title}
            </h1>
            <p className="mt-1 text-xs text-faint">
              {quiz.questions.length} câu ·{" "}
              <span className="font-semibold text-[rgb(var(--text))]">
                {answeredCount} đã trả lời
              </span>
            </p>
          </div>

          {remainingSec !== null && (
            <div className="rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                Thời gian còn lại
              </p>
              <p
                className={`mt-1 font-mono text-2xl font-bold tabular-nums ${
                  timerDanger ? "text-danger-600" : "text-[rgb(var(--text))]"
                }`}
              >
                {String(minutes).padStart(2, "0")}:
                {String(seconds).padStart(2, "0")}
              </p>
            </div>
          )}

          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-faint">
              Bản đồ câu hỏi
            </p>
            <div className="grid grid-cols-6 gap-1.5">
              {quiz.questions.map((q, idx) => {
                const answered = !isAnswerIncomplete(q, answers[q.id]);
                const isCurrent = idx === currentStepIndex;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => jumpTo(idx)}
                    className={`flex h-9 items-center justify-center rounded-md text-xs font-semibold tabular-nums transition-colors ${
                      isCurrent
                        ? "bg-brand-600 text-white ring-2 ring-brand-300"
                        : answered
                          ? "bg-brand-soft text-brand-700 hover:bg-brand-100"
                          : "bg-[rgb(var(--surface-muted))] text-muted hover:bg-base-100"
                    }`}
                    aria-label={`Câu ${idx + 1}${answered ? " (đã trả lời)" : ""}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSubmit()}
            disabled={submitting}
            className={`${submitClass} w-full`}
          >
            {submitting ? "Đang nộp…" : "Nộp bài"}
          </button>
        </div>
      </aside>

      {/* MOBILE — sticky bottom strip with timer + palette + submit */}
      <div className="sticky bottom-0 left-0 right-0 z-30 -mx-4 mt-4 border-t border-token bg-[rgb(var(--surface))/0.95] px-4 py-3 backdrop-blur lg:hidden">
        <div className="mb-2 flex items-center justify-between gap-3">
          {remainingSec !== null && (
            <span
              className={`rounded px-2 py-1 font-mono text-sm tabular-nums ${
                timerDanger
                  ? "bg-danger-100 text-danger-700"
                  : "bg-[rgb(var(--surface-muted))] text-[rgb(var(--text))]"
              }`}
            >
              {String(minutes).padStart(2, "0")}:
              {String(seconds).padStart(2, "0")}
            </span>
          )}
          <button
            type="button"
            onClick={() => onSubmit()}
            disabled={submitting}
            className={`${submitClass} btn-sm ml-auto`}
          >
            {submitting ? "Đang nộp…" : "Nộp bài"}
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {quiz.questions.map((q, idx) => {
            const answered = !isAnswerIncomplete(q, answers[q.id]);
            const isCurrent = idx === currentStepIndex;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => jumpTo(idx)}
                className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold tabular-nums ${
                  isCurrent
                    ? "bg-brand-600 text-white"
                    : answered
                      ? "bg-brand-soft text-brand-700"
                      : "bg-[rgb(var(--surface-muted))] text-muted"
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
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

    case "drag_drop_fill":
      return <DragDropFillInput question={question} answer={answer} onChange={onChange} onBlur={onBlur} />;

    case "mcq":
    case "true_false":
    default: {
      const selected = Array.isArray(answer?.response)
        ? (answer!.response as string[])
        : [];
      // true_false luôn 1 đáp án; mcq với đúng 1 option đúng (server tính,
      // không lộ đáp án nào) cũng vậy — chọn cái mới tự bỏ cái cũ, thay vì
      // để học viên tick nhầm thêm phương án sai vào một câu vốn chỉ có 1
      // đáp án đúng.
      const isSingleChoice = question.type === "true_false" || question.isSingleAnswer === true;
      function toggle(optId: string) {
        if (isSingleChoice) {
          onChange([optId]);
        } else {
          const next = selected.includes(optId)
            ? selected.filter((x) => x !== optId)
            : [...selected, optId];
          onChange(next);
        }
        setTimeout(onBlur, 0);
      }
      const isRadio = isSingleChoice;
      // True/False và mcq-1-đáp-án luôn 1 cột (radio đọc dọc tự nhiên hơn).
      // MCQ nhiều đáp án ≥ tablet hiển thị 2 cột để tận dụng không gian
      // ngang trên laptop, tránh cảm giác "mobile single-column".
      const listClass = isRadio
        ? "space-y-2"
        : "grid grid-cols-1 gap-2 sm:grid-cols-2";
      return (
        <ul className={listClass}>
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
                  <SafeHtml
                    html={plainToRichHtml(opt.label)}
                    className="prose prose-sm max-w-none text-sm dark:prose-invert"
                  />
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
  // Build the working list of option IDs:
  //   1) Start from saved response if it's a string[] (resume case).
  //   2) Filter out IDs no longer in question.options (option deleted server-side).
  //   3) APPEND any new question.options not present in the saved response —
  //      previously the player just discarded the saved response and reset to
  //      canonical order if ANY id was missing, but the more common case is
  //      "instructor added option N+1 after attempt started" → saved response
  //      had N ids, new option Nth+1 silently disappeared from UI.
  const validIds = new Set(question.options.map((o) => o.id));
  const saved = Array.isArray(answer?.response)
    ? (answer!.response as string[]).filter((id) => validIds.has(id))
    : [];
  const missing = question.options
    .map((o) => o.id)
    .filter((id) => !saved.includes(id));
  const ids = saved.length > 0 ? [...saved, ...missing] : question.options.map((o) => o.id);
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
            <SafeHtml
              html={plainToRichHtml(optById.get(id)?.label ?? "")}
              className="prose prose-sm max-w-none flex-1 text-sm dark:prose-invert"
            />
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
      <SafeHtml
        html={plainToRichHtml(label)}
        className="prose prose-sm max-w-none text-sm dark:prose-invert"
      />
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
            <SafeHtml
              html={plainToRichHtml(l.label)}
              className="prose prose-sm max-w-none flex-1 text-sm font-medium dark:prose-invert"
            />
            <span className="text-faint">→</span>
            <select
              value={byLeft.get(l.id) ?? ""}
              onChange={(e) => pick(l.id, e.target.value)}
              className="select max-w-[220px]"
            >
              <option value="">— chọn —</option>
              {rights.map((r) => (
                <option key={r.id} value={r.id}>
                  {htmlToPlainText(r.label)}
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
      <SafeHtml
        html={plainToRichHtml(leftLabel)}
        className="prose prose-sm max-w-none flex-1 text-sm font-medium dark:prose-invert"
      />
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
      <SafeHtml
        html={plainToRichHtml(label)}
        className="prose prose-sm max-w-none text-sm dark:prose-invert"
      />
    </span>
  );
}

// ─── DRAG-DROP FILL ─────────────────────────────────────────────────────────
//
// Renders the prompt with [[N]] placeholders replaced by drop zones. A pool of
// draggable tokens (correct + distractors) sits below. Learner drags each
// token into a blank; only one token per blank. Response shape:
//   { tokens: { [blankIndex: number]: optionId } }
//
// Backed by @dnd-kit (already used for matching). Mobile fallback: tap a
// blank, then tap a token to assign (same pattern as MatchingInput mobile).

function DragDropFillInput({
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
  // Parse prompt into segments split by [[N]] placeholders. Each placeholder
  // becomes a drop-zone slot with blankIndex = N. Plain text segments stay
  // text. Backend strips HTML for grading, so we treat prompt as plain text
  // (the instructor enters it via plain RichTextEditor but we render as text
  // here so the drop zones can be inline-flow-aware).
  const segments = parsePromptBlanks(question.prompt);
  // Distinct blanks discovered in the prompt — what UI actually offers.
  const blanksInPrompt = Array.from(
    new Set(
      segments
        .filter((s): s is { kind: "blank"; index: number } => s.kind === "blank")
        .map((s) => s.index),
    ),
  ).sort((a, b) => a - b);

  // Current placements: blankIndex (as string key) → optionId. Pulled from
  // saved answer if any.
  const raw = answer?.response as { tokens?: Record<string, string> } | unknown;
  const placed: Record<string, string> =
    typeof raw === "object" && raw !== null && "tokens" in raw
      ? { ...(raw as { tokens: Record<string, string> }).tokens }
      : {};

  const tokens = question.options;
  const placedOptionIds = new Set(Object.values(placed));
  const poolTokens = tokens.filter((t) => !placedOptionIds.has(t.id));

  function commit(next: Record<string, string>) {
    onChange({ tokens: next });
    setTimeout(onBlur, 0);
  }
  function place(blankIdx: number, optionId: string) {
    const next = { ...placed };
    // If this option is already placed in another blank, remove it there.
    for (const [k, v] of Object.entries(next)) {
      if (v === optionId && Number(k) !== blankIdx) delete next[k];
    }
    next[String(blankIdx)] = optionId;
    commit(next);
  }
  function clear(blankIdx: number) {
    const next = { ...placed };
    delete next[String(blankIdx)];
    commit(next);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );
  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const optionId = String(active.id).replace(/^token:/, "");
    const overId = String(over.id);
    if (overId === "ddf:pool") {
      // Drop back to pool → unassign wherever this option was.
      for (const [k, v] of Object.entries(placed)) {
        if (v === optionId) {
          clear(Number(k));
          return;
        }
      }
      return;
    }
    if (overId.startsWith("blank:")) {
      const idx = Number(overId.slice("blank:".length));
      if (Number.isFinite(idx)) place(idx, optionId);
    }
  }

  // No blanks parsed (instructor forgot [[N]] markers) — degrade to plain
  // prompt + token list with manual click-to-place so question still works.
  if (blanksInPrompt.length === 0) {
    return (
      <div className="rounded-lg border border-accent-200 bg-accent-50 p-3 text-sm text-accent-800">
        Câu hỏi này thiếu ký hiệu ô <code>[[1]]</code>… trong nội dung. Liên hệ
        giảng viên.
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="rounded-xl border border-token bg-[rgb(var(--surface))] p-4">
        <div className="flex flex-wrap items-center gap-2 leading-loose text-base">
          {segments.map((seg, i) => {
            if (seg.kind === "text") {
              return (
                <span key={i} className="whitespace-pre-wrap">
                  {seg.text}
                </span>
              );
            }
            const placedId = placed[String(seg.index)];
            const placedOpt = placedId
              ? tokens.find((t) => t.id === placedId)
              : null;
            return (
              <DragDropBlank
                key={i}
                blankIndex={seg.index}
                placed={placedOpt ?? null}
                onClear={() => clear(seg.index)}
              />
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-xs text-faint">Kéo các từ bên dưới thả vào ô tương ứng:</p>
      <DragDropTokenPool tokens={poolTokens} />
    </DndContext>
  );
}

function parsePromptBlanks(
  prompt: string,
): Array<{ kind: "text"; text: string } | { kind: "blank"; index: number }> {
  const out: Array<{ kind: "text"; text: string } | { kind: "blank"; index: number }> = [];
  const re = /\[\[(\d+)\]\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(prompt)) !== null) {
    if (m.index > last) out.push({ kind: "text", text: prompt.slice(last, m.index) });
    out.push({ kind: "blank", index: Number(m[1]) });
    last = m.index + m[0].length;
  }
  if (last < prompt.length) out.push({ kind: "text", text: prompt.slice(last) });
  return out;
}

function DragDropBlank({
  blankIndex,
  placed,
  onClear,
}: {
  blankIndex: number;
  placed: Option | null;
  onClear: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `blank:${blankIndex}` });
  return (
    <span
      ref={setNodeRef}
      className={`inline-flex min-h-[34px] min-w-[110px] items-center justify-between gap-2 rounded-md border-2 border-dashed px-2 py-0.5 align-middle text-sm transition-colors ${
        isOver
          ? "border-brand-500 bg-brand-soft"
          : placed
            ? "border-brand-300 bg-[rgb(var(--surface))]"
            : "border-token bg-[rgb(var(--surface-muted))]"
      }`}
    >
      {placed ? (
        <>
          <DragDropToken option={placed} compact />
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-faint hover:text-danger-600"
            aria-label="Bỏ chọn token này"
            title="Bỏ"
          >
            ×
          </button>
        </>
      ) : (
        <span className="text-xs text-faint">Ô {blankIndex}</span>
      )}
    </span>
  );
}

function DragDropTokenPool({ tokens }: { tokens: Option[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: "ddf:pool" });
  return (
    <div
      ref={setNodeRef}
      className={`mt-2 flex flex-wrap gap-2 rounded-xl border-2 border-dashed p-3 transition-colors ${
        isOver
          ? "border-brand-500 bg-brand-soft"
          : "border-token bg-[rgb(var(--surface-muted))]"
      }`}
    >
      {tokens.length === 0 ? (
        <span className="text-xs text-faint">Đã đặt hết token. Kéo lại vào đây để bỏ.</span>
      ) : (
        tokens.map((t) => <DragDropToken key={t.id} option={t} />)
      )}
    </div>
  );
}

function DragDropToken({ option, compact = false }: { option: Option; compact?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `token:${option.id}`,
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
      className={`inline-flex cursor-grab touch-none items-center rounded-lg border border-token bg-[rgb(var(--surface))] ${
        compact ? "px-2 py-0.5" : "px-3 py-1.5"
      } text-sm shadow-sm transition-shadow hover:shadow active:cursor-grabbing`}
    >
      <SafeHtml
        html={plainToRichHtml(option.label)}
        className="prose prose-sm max-w-none text-sm dark:prose-invert"
      />
    </span>
  );
}
