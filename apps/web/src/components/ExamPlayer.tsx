"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Megaphone, MessageSquare, Timer, WifiOff } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import {
  diffDraftAgainstServer,
  estimateClockSkewMs,
  humanizeSubmitError,
  remainingSec as calcRemainingSec,
  retryDelayMs,
} from "@/lib/examPlayerSync";
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
  exam: {
    id: string;
    title: string;
    showResultsAfterSubmit: boolean;
    /** none | basic | strict. `none` thì không ép toàn màn hình. */
    proctoringLevel?: string;
  };
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
  // Mọi callback bất đồng bộ (hẹn giờ lưu, tự nộp khi hết giờ) đọc giá trị mới
  // nhất qua ref. Bản cũ để closure của lần render đầu chạy suốt phiên nên tự nộp
  // bằng `answers` ban đầu và khoá phiên cũ.
  const sessionTokenRef = useRef(sessionToken);
  useEffect(() => { sessionTokenRef.current = sessionToken; }, [sessionToken]);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(() => {
    const m: Record<string, AnswerValue> = {};
    for (const a of props.initialAnswers) m[a.questionId] = a.answerJson as AnswerValue;
    // Restore any draft saved during a prior offline period. Draft wins per-question
    // because it was written more recently than the server snapshot. Những câu khác
    // server sẽ được đẩy lên ngay khi mount (xem effect "flush bản nháp" bên dưới).
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
  const submittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);

  // Ref mirror of answers — needed in async callbacks to avoid stale closures.
  const answersRef = useRef(answers);
  useEffect(() => { answersRef.current = answers; }, [answers]);

  // questionIds whose latest value is in localStorage but not yet confirmed by server.
  const pendingSync = useRef<Set<string>>(new Set());

  // Thời lượng có thể TĂNG giữa chừng (giảng viên gia hạn) nên là state, cập nhật
  // qua heartbeat. Độ lệch đồng hồ cũng được chỉnh lại theo heartbeat.
  const [durationSec, setDurationSec] = useState(props.durationSec);
  const clockSkewRef = useRef(new Date(props.serverNow).getTime() - Date.now());
  const deadlineEpoch = useMemo(
    () => new Date(props.startedAt).getTime() + durationSec * 1000,
    [props.startedAt, durationSec],
  );
  const deadlineRef = useRef(deadlineEpoch);
  useEffect(() => { deadlineRef.current = deadlineEpoch; }, [deadlineEpoch]);
  const [remainingSec, setRemainingSec] = useState(() =>
    calcRemainingSec(deadlineEpoch, Date.now(), clockSkewRef.current),
  );

  const clearLocalState = useCallback(() => {
    try {
      localStorage.removeItem(draftKey(props.attemptId));
      for (const p of props.passages) {
        localStorage.removeItem(`exam:${props.attemptId}:passage:${p.id}`);
      }
    } catch { /* storage unavailable — ignore */ }
  }, [props.attemptId, props.passages]);

  // Hỏi server hạn làm bài + trạng thái hiện tại (heartbeat). Trả null nếu không
  // liên lạc được.
  const syncFromServer = useCallback(async () => {
    const t0 = Date.now();
    try {
      const res = await fetch(apiUrl(`/api/exam-attempts/${props.attemptId}/heartbeat`), {
        method: "POST",
      });
      if (!res.ok) return null;
      const j = (await res.json()) as {
        serverNow?: string;
        status?: string;
        durationSec?: number;
      };
      const skew = estimateClockSkewMs(j.serverNow, t0, Date.now());
      if (skew !== null) clockSkewRef.current = skew;
      if (typeof j.durationSec === "number") setDurationSec(j.durationSec);
      if (j.status && j.status !== "in_progress") {
        // Bài đã bị nộp/chấm ở nơi khác (giám thị buộc nộp, tab khác...).
        clearLocalState();
        router.replace(props.resultUrl);
      }
      return j;
    } catch {
      return null;
    }
  }, [props.attemptId, props.resultUrl, router, clearLocalState]);

  // Hết giờ → tự nộp. Hỏi server một lần trước khi nộp: có thể vừa được gia hạn
  // mà heartbeat chưa kịp báo (tối đa 10s).
  const onTimeUpRef = useRef<() => Promise<void>>(async () => undefined);
  const submitAttemptRef = useRef<(auto?: boolean) => Promise<void>>(async () => undefined);
  onTimeUpRef.current = async () => {
    const j = await syncFromServer();
    if (j?.status && j.status !== "in_progress") return;
    if (
      typeof j?.durationSec === "number" &&
      calcRemainingSec(
        new Date(props.startedAt).getTime() + j.durationSec * 1000,
        Date.now(),
        clockSkewRef.current,
      ) > 0
    ) {
      return; // được gia hạn: state đổi, hẹn giờ chạy lại với hạn mới
    }
    await submitAttemptRef.current(true);
  };

  useEffect(() => {
    const t = setInterval(() => {
      const r = calcRemainingSec(deadlineRef.current, Date.now(), clockSkewRef.current);
      setRemainingSec(r);
      if (r <= 0) {
        clearInterval(t);
        void onTimeUpRef.current();
      }
    }, 1_000);
    return () => clearInterval(t);
  }, [deadlineEpoch]);

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
  const retryTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const retryCount = useRef<Record<string, number>>({});
  const inflightHash = useRef<Record<string, string>>({});
  const sendSaveRef = useRef<(qid: string, v: AnswerValue) => Promise<boolean>>(
    async () => false,
  );

  // Lưu lỗi (5xx, 429, mất mạng) thì thử lại với thời gian chờ tăng dần, gửi giá
  // trị MỚI NHẤT của câu đó. Bản cũ chỉ thử lại khi thí sinh sửa tiếp hoặc lúc
  // nộp, nên một lần lỗi thoáng qua có thể để câu đó không bao giờ lên server.
  const scheduleRetry = useCallback((qid: string) => {
    if (retryTimers.current[qid]) return;
    const n = retryCount.current[qid] ?? 0;
    retryCount.current[qid] = n + 1;
    retryTimers.current[qid] = setTimeout(() => {
      delete retryTimers.current[qid];
      if (!pendingSync.current.has(qid)) return;
      const v = answersRef.current[qid];
      if (v === undefined) {
        pendingSync.current.delete(qid);
        return;
      }
      void sendSaveRef.current(qid, v);
    }, retryDelayMs(n));
  }, []);

  /** Trả true khi server đã xác nhận đã lưu. */
  const sendSave = useCallback(
    async (questionId: string, answerJson: AnswerValue): Promise<boolean> => {
      setSaveState("saving");
      try {
        const res = await fetch(
          apiUrl(`/api/exam-attempts/${props.attemptId}/answers/${questionId}`),
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ answerJson, sessionToken: sessionTokenRef.current }),
          },
        );
        if (res.status === 409) {
          const j = (await res.json().catch(() => null)) as { error?: string } | null;
          if (j?.error === "session_stale") {
            // Giữ câu trong hàng đợi: sau khi bấm "Tiếp tục trên thiết bị này" sẽ
            // được đẩy lại bằng khoá mới.
            pendingSync.current.add(questionId);
            setSaveState("stale");
            return false;
          }
          if (j?.error === "attempt_already_submitted") {
            clearLocalState();
            router.replace(props.resultUrl);
            return false;
          }
        }
        if (!res.ok) {
          pendingSync.current.add(questionId);
          setSaveState("error");
          scheduleRetry(questionId);
          return false;
        }
        const r = (await res.json()) as { answerHash: string; persisted: boolean };
        inflightHash.current[questionId] = r.answerHash;
        retryCount.current[questionId] = 0;
        // Chỉ coi là đã đồng bộ nếu giá trị vừa lưu vẫn là giá trị hiện tại; nếu
        // thí sinh đã sửa tiếp trong lúc chờ phản hồi thì câu vẫn còn chờ lưu.
        if (
          JSON.stringify(answersRef.current[questionId] ?? null) ===
          JSON.stringify(answerJson ?? null)
        ) {
          pendingSync.current.delete(questionId);
        }
        setSaveState(pendingSync.current.size === 0 ? "saved" : "saving");
        return true;
      } catch {
        // Network failure — answer is already in localStorage (written by onChange).
        pendingSync.current.add(questionId);
        setSaveState(navigator.onLine ? "error" : "offline");
        scheduleRetry(questionId);
        return false;
      }
    },
    [props.attemptId, props.resultUrl, router, clearLocalState, scheduleRetry],
  );
  useEffect(() => { sendSaveRef.current = sendSave; }, [sendSave]);

  // Flush bản nháp lên server ngay khi mount: những câu làm lúc mất mạng rồi tải
  // lại trang đang chỉ nằm trong localStorage. Bản cũ chỉ đọc nháp vào giao diện,
  // nên màn hình hiện đủ đáp án còn server không có câu nào.
  useEffect(() => {
    let draft: Record<string, unknown> | null = null;
    try {
      const raw = localStorage.getItem(draftKey(props.attemptId));
      draft = raw ? (JSON.parse(raw) as { answers: Record<string, unknown> }).answers : null;
    } catch { /* storage unavailable — ignore */ }
    for (const qid of diffDraftAgainstServer(draft, props.initialAnswers)) {
      pendingSync.current.add(qid);
    }
    for (const qid of [...pendingSync.current]) {
      const v = answersRef.current[qid];
      if (v !== undefined) void sendSaveRef.current(qid, v);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      // Giá trị mới sẽ được gửi bởi lần debounce này, huỷ lần thử lại của giá trị cũ.
      const retry = retryTimers.current[questionId];
      if (retry) {
        clearTimeout(retry);
        delete retryTimers.current[questionId];
      }
      pendingTimers.current[questionId] = setTimeout(() => {
        delete pendingTimers.current[questionId];
        void sendSave(questionId, value);
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
    sessionTokenRef.current = j.sessionToken;
    setSessionToken(j.sessionToken);
    setSaveState("idle");
    // Đường học viên đăng nhập mang khoá phiên trên URL (?st=) và trang ưu tiên nó
    // hơn khoá trong DB. Không cập nhật URL thì F5 sau khi "Tiếp tục trên thiết bị
    // này" tải lại với khoá cũ và bị đánh dấu stale ngay.
    try {
      const u = new URL(window.location.href);
      if (u.searchParams.has("st")) {
        u.searchParams.set("st", j.sessionToken);
        window.history.replaceState(null, "", u.toString());
      }
    } catch { /* URL không đọc được — bỏ qua */ }
    // Đẩy lại những câu bị từ chối vì khoá cũ.
    for (const qid of [...pendingSync.current]) {
      const v = answersRef.current[qid];
      if (v !== undefined) void sendSaveRef.current(qid, v);
    }
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
    // Chỉ ghi lần dán ĐỦ DÀI để đáng nghi.
    //
    // Bản cũ ghi mọi lần dán, kể cả dán lại hai chữ vừa cắt trong chính ô trả
    // lời — thao tác soạn thảo bình thường. Nó vừa làm bảng sự cố đầy rác vừa
    // làm loãng cờ paste_flood: dán 20 lần mỗi lần 3 ký tự không phải chép
    // bài, mà vẫn kích cờ.
    //
    // Ngưỡng đặt ở đây chứ không phải lúc đọc: sự cố là bản ghi vĩnh viễn,
    // không nên đẻ ra rồi lọc sau.
    const PASTE_MIN_CHARS = 20;
    const onPaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData("text") ?? "";
      if (text.length < PASTE_MIN_CHARS) return;
      logIncident("paste", { pastedLength: text.length });
    };
    const onOffline = () => logIncident("network_lost");
    // Thoát toàn màn hình: CHỜ XEM có quay lại không rồi mới ghi nhận.
    //
    // Sinh viên phản ánh đúng: một cửa sổ chat nổi trên màn hình (Zalo,
    // Messenger, thông báo hệ điều hành) giành tiêu điểm là trình duyệt rớt
    // khỏi toàn màn hình, dù người ta không hề rời bài. Ghi thẳng thì mỗi tin
    // nhắn tới là một lần bị đánh dấu, và bảng sự cố đầy những thứ không phải
    // gian lận.
    //
    // Nay: rớt rồi quay lại trong GRACE thì bỏ qua. Quá GRACE mới ghi, kèm
    // thời gian ở ngoài để giáo viên phân biệt "chớp 0,4 giây" với "đi 45
    // giây". Chớp liên tục vẫn bị ghi một lần khi đủ BLIP_LIMIT — nếu không
    // thì thoát ra 4 giây một lần sẽ thành lỗ hổng.
    const GRACE_MS = 5_000;
    const BLIP_LIMIT = 3;
    let exitAt: number | null = null;
    let pending: ReturnType<typeof setTimeout> | null = null;
    let blips = 0;

    const onFullscreenExit = () => {
      if (!document.fullscreenElement) {
        exitAt = Date.now();
        pending = setTimeout(() => {
          pending = null;
          logIncident("fullscreen_exit", {
            awaySec: Math.round((Date.now() - (exitAt ?? Date.now())) / 1000),
            returned: false,
          });
        }, GRACE_MS);
        return;
      }
      // Quay lại rồi.
      if (pending) {
        clearTimeout(pending);
        pending = null;
        blips++;
        const awayMs = Date.now() - (exitAt ?? Date.now());
        if (blips >= BLIP_LIMIT) {
          logIncident("fullscreen_exit", {
            awaySec: Math.round(awayMs / 1000),
            returned: true,
            blips,
          });
          blips = 0;
        }
      }
      exitAt = null;
    };
    window.addEventListener("paste", onPaste, true);
    window.addEventListener("offline", onOffline);
    document.addEventListener("fullscreenchange", onFullscreenExit);
    return () => {
      if (pending) clearTimeout(pending);
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

  // A5.3 — Heartbeat for the instructor live dashboard, every 10s. Nay phản hồi
  // mang theo hạn làm bài + trạng thái + giờ server (xem syncFromServer).
  useEffect(() => {
    let cancelled = false;
    void syncFromServer();
    const t = setInterval(() => {
      if (!cancelled) void syncFromServer();
    }, 10_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [syncFromServer]);

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
      if (submittingRef.current) return;
      submittingRef.current = true;
      setSubmitting(true);
      setError(null);
      const fail = (msg: string) => {
        setError(msg);
        submittingRef.current = false;
        setSubmitting(false);
      };
      try {
        // Dừng mọi hẹn giờ lưu/thử lại, rồi đẩy MỌI câu chưa được server xác nhận
        // bằng giá trị MỚI NHẤT (ref). Bản cũ dùng `answers` của closure lúc tạo
        // hàm và duyệt các khoá timer không bao giờ được xoá, nên lúc hết giờ nó
        // ghi đè đáp án bằng dữ liệu cũ.
        const queued = new Set<string>([
          ...pendingSync.current,
          ...Object.keys(pendingTimers.current),
        ]);
        for (const t of Object.values(pendingTimers.current)) clearTimeout(t);
        pendingTimers.current = {};
        for (const t of Object.values(retryTimers.current)) clearTimeout(t);
        retryTimers.current = {};
        await Promise.all(
          [...queued].map((qid) => {
            const v = answersRef.current[qid];
            return v === undefined ? Promise.resolve(true) : sendSaveRef.current(qid, v);
          }),
        );
        // Nộp tay khi còn câu chưa lên được server: dừng lại để thí sinh xử lý
        // (mạng?) thay vì chấm bài thiếu câu. Nộp tự động (hết giờ) thì vẫn nộp.
        const unsynced = pendingSync.current.size;
        if (unsynced > 0 && !auto) {
          fail(`Chưa lưu được ${unsynced} câu trả lời lên hệ thống. ${humanizeSubmitError("network_error")}`);
          return;
        }
        // Nộp tự động thử lại vài lần: lỗi mạng thoáng qua không được làm mất bài.
        const tries = auto ? 4 : 1;
        let lastCode = "network_error";
        for (let i = 0; i < tries; i++) {
          try {
            const res = await fetch(
              apiUrl(`/api/exam-attempts/${props.attemptId}/submit`),
              { method: "POST" },
            );
            if (res.ok) {
              clearLocalState();
              router.replace(props.resultUrl);
              return;
            }
            const j = (await res.json().catch(() => null)) as { error?: string } | null;
            lastCode = j?.error ?? "submit_failed";
            if (lastCode === "attempt_already_submitted") {
              clearLocalState();
              router.replace(props.resultUrl);
              return;
            }
          } catch {
            lastCode = "network_error";
          }
          if (i < tries - 1) await new Promise((r) => setTimeout(r, 3_000));
        }
        // Không nộp được: giữ nguyên bản nháp trên máy, cho thí sinh bấm nộp lại.
        fail(humanizeSubmitError(lastCode));
      } catch {
        fail(humanizeSubmitError("network_error"));
      }
    },
    [props.attemptId, props.resultUrl, router, clearLocalState],
  );
  submitAttemptRef.current = submitAttempt;

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
        // Trước đây ghi cứng `required` — proctoringLevel không bao giờ được
        // đọc, dù chú thích của chính prop này nói "false khi
        // proctoringLevel=none". Nên đề khai báo KHÔNG giám sát vẫn ép toàn
        // màn hình, và trên iPad thì đó là ép vào một chế độ mà bàn phím ảo
        // không bật lên được.
        required={props.exam.proctoringLevel !== "none"}
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
          {error}
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
    error: { text: "Lưu lỗi — đang thử lại", cls: "text-red-700" },
    stale: { text: "Phiên đã được mở ở tab khác", cls: "text-red-700" },
    offline: { text: "Lưu tạm — chờ kết nối", cls: "text-amber-700" },
  };
  const v = map[state];
  return <span className={v.cls}>{v.text}</span>;
}
