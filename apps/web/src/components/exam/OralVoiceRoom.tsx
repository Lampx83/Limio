"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Info, Keyboard, LogOut, Mic, Square, Timer, X } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { usePacedReveal } from "@/hooks/usePacedReveal";
import UserAvatar from "@/components/ui/UserAvatar";
import SafeHtml from "@/components/SafeHtml";
import FullscreenGate from "./FullscreenGate";
import TabBlurWarning from "./TabBlurWarning";
import MultiTabDetector from "./MultiTabDetector";
import OralAiAvatar, { type OralAvatarState } from "./OralAiAvatar";

const MAX_ORAL_QUESTIONS = 8; // giữ đồng bộ với packages/core-feedback/src/oralExam/examinerChat.ts

interface Turn {
  role: "student" | "examiner";
  content: string;
}

interface Props {
  examId: string;
  attemptId: string;
  examTitle: string;
  courseTitle: string;
  startedAt: string;
  durationSec: number;
  serverNow: string;
  initialTurns: Turn[];
  submittedUrl: string;
  /** Trang khoá học — nút "Thoát" quay lại đây. Bài làm vẫn ở nguyên trạng
   * thái đang thi, resume được khi vào lại (không phải nộp bài). */
  exitUrl: string;
  /** Hướng dẫn/thông báo do GV soạn (richtext) — hiện ở panel bên phải. */
  instructionsHtml: string | null;
  /** Tên hiển thị của sinh viên — cho avatar tròn trong khung chat. */
  studentName?: string | null;
  /** Ảnh đại diện sinh viên; không có thì UserAvatar tự fallback initial. */
  studentImageUrl?: string | null;
}

const FRIENDLY_ERROR: Record<string, string> = {
  openai_not_configured: "Admin chưa cấu hình OpenAI key — báo giảng viên/admin.",
  vbee_not_configured: "Admin chưa cấu hình Vbee (giọng nói) — báo giảng viên/admin, hoặc chuyển sang gõ chữ.",
  rate_limited: "Bạn thao tác quá nhanh, đợi một chút rồi thử lại.",
  global_token_cap: "Hệ thống đã chạm trần AI hôm nay — báo giảng viên, đây không phải lỗi của bạn.",
  empty_transcript: "Không nghe rõ câu trả lời — ghi âm lại, hoặc chuyển sang gõ chữ.",
  stt_timeout: "Nhận dạng giọng nói mất quá lâu — thử lại, hoặc chuyển sang gõ chữ.",
  stt_failed: "Không nhận dạng được câu trả lời — thử lại, hoặc chuyển sang gõ chữ.",
  stt_submit_failed: "Không gửi được bản ghi âm — kiểm tra mạng rồi thử lại.",
  mic_denied: "Trình duyệt chặn quyền micro — vào cài đặt site để bật, hoặc chuyển sang gõ chữ.",
};

/**
 * A6.6 — Phòng vấn đáp bằng giọng nói. Khác OralExamRoom (bản chữ, SSE từng
 * ký tự): mỗi lượt là MỘT request đợi trọn (STT → chat → TTS xong mới trả
 * về), không có gì để stream. Ghi âm bằng MediaRecorder, gửi multipart tới
 * voice-turn, phát audioChunks nối tiếp theo đúng thứ tự Vbee trả về.
 *
 * "Gõ chữ thay vì nói" dùng THẲNG endpoint SSE của bản chữ (/turn) — route đó
 * không kiểm tra answerMode, chỉ cần đúng attemptId, nên vẫn ghi vào cùng
 * transcript. Đây là lối thoát khi mic hỏng/TTS lỗi, không phải chế độ riêng.
 */
export default function OralVoiceRoom({
  examId,
  attemptId,
  examTitle,
  courseTitle,
  startedAt,
  durationSec,
  serverNow,
  initialTurns,
  submittedUrl,
  exitUrl,
  instructionsHtml,
  studentName,
  studentImageUrl,
}: Props) {
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>(initialTurns);
  const [questionsAsked, setQuestionsAsked] = useState(
    initialTurns.filter((t) => t.role === "examiner").length,
  );
  const [ended, setEnded] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [textFallback, setTextFallback] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const reveal = usePacedReveal();
  const kickedOff = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const objectUrlsRef = useRef<string[]>([]);
  // Lời AI của lượt vừa nhận — chờ paced reveal lộ hết rồi mới chốt vào
  // `turns` (xem effect bên dưới). Cùng khuôn OralExamRoom.
  const finalizeRef = useRef<{
    examinerText: string;
    questionsAsked?: number;
    ended?: boolean;
  } | null>(null);
  const liveRef = useRef({ turns, ended, input, recording, processing });
  liveRef.current = { turns, ended, input, recording, processing };

  const clockSkewMs = useMemo(
    () => new Date(serverNow).getTime() - Date.now(),
    [serverNow],
  );
  const deadlineEpoch = useMemo(
    () => new Date(startedAt).getTime() + durationSec * 1000,
    [startedAt, durationSec],
  );
  const [remainingSec, setRemainingSec] = useState(() =>
    Math.max(0, Math.floor((deadlineEpoch - (Date.now() + clockSkewMs)) / 1000)),
  );

  const revokeQueuedUrls = useCallback(() => {
    for (const u of objectUrlsRef.current) URL.revokeObjectURL(u);
    objectUrlsRef.current = [];
  }, []);

  const playAudioChunks = useCallback(
    (chunksB64: string[], contentType: string) => {
      const audio = audioRef.current;
      if (!audio || chunksB64.length === 0) return;
      revokeQueuedUrls();
      const urls = chunksB64.map((b64) => {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        return URL.createObjectURL(new Blob([bytes], { type: contentType }));
      });
      objectUrlsRef.current = urls;
      let i = 0;
      setSpeaking(true);
      const playNext = () => {
        if (i >= urls.length) {
          setSpeaking(false);
          revokeQueuedUrls();
          return;
        }
        audio.src = urls[i]!;
        i++;
        void audio.play().catch(() => setSpeaking(false));
      };
      audio.onended = playNext;
      playNext();
    },
    [revokeQueuedUrls],
  );

  // Chốt lời AI vào lịch sử NGAY KHI paced reveal lộ hết — dùng chung cho cả
  // sendVoiceTurn (JSON 1 cục) lẫn sendTextTurn (SSE), tách khỏi thời điểm dữ
  // liệu thật sự về tới (xem finalizeRef ở trên).
  useEffect(() => {
    const pending = finalizeRef.current;
    if (!pending || reveal.revealed !== pending.examinerText) return;
    setTurns((prev) => [...prev, { role: "examiner", content: pending.examinerText }]);
    setProcessing(false);
    if (typeof pending.questionsAsked === "number") setQuestionsAsked(pending.questionsAsked);
    if (pending.ended) setEnded(true);
    finalizeRef.current = null;
  }, [reveal.revealed]);

  // Lượt bằng giọng nói: audioBlob=null cho câu hỏi mở màn (chưa có gì để
  // ghi âm), giống message=null của bản chữ. forceEnd = SV bấm "Kết thúc".
  const sendVoiceTurn = useCallback(
    async (audioBlob: Blob | null, opts?: { forceEnd?: boolean }) => {
      setError(null);
      setProcessing(true);
      reveal.reset();
      try {
        const form = new FormData();
        if (audioBlob) form.append("audio", audioBlob, "answer.webm");
        if (opts?.forceEnd) form.append("forceEnd", "1");
        const res = await fetch(
          apiUrl(`/api/exams/${examId}/oral-attempt/${attemptId}/voice-turn`),
          { method: "POST", body: form },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(typeof data?.error === "string" ? data.error : "voice_turn_failed");
          setProcessing(false);
          return;
        }
        if (data.studentTranscript) {
          setTurns((prev) => [...prev, { role: "student", content: data.studentTranscript }]);
        }
        if (Array.isArray(data.audioChunks) && data.audioChunks.length > 0) {
          playAudioChunks(data.audioChunks, data.contentType ?? "audio/mpeg");
        }
        const examinerText: string = data.assistantText ?? "";
        if (examinerText) {
          reveal.push(examinerText);
          finalizeRef.current = {
            examinerText,
            questionsAsked: typeof data.questionsAsked === "number" ? data.questionsAsked : undefined,
            ended: Boolean(data.ended),
          };
          // processing tắt trong effect finalize ở trên, không tắt ở đây —
          // giữ trạng thái "đang nói" cho tới khi lộ hết chữ.
        } else {
          setProcessing(false);
          if (typeof data.questionsAsked === "number") setQuestionsAsked(data.questionsAsked);
          if (data.ended) setEnded(true);
        }
      } catch (e) {
        setError((e as Error).message || "network_error");
        setProcessing(false);
      }
    },
    [examId, attemptId, playAudioChunks, reveal],
  );

  // Lượt bằng chữ (lối thoát khi mic/TTS hỏng) — SSE, cùng khuôn OralExamRoom.
  const sendTextTurn = useCallback(
    async (message: string | null, opts?: { forceEnd?: boolean }) => {
      setError(null);
      setProcessing(true);
      reveal.reset();
      if (message) setTurns((prev) => [...prev, { role: "student", content: message }]);
      let acc = "";
      let doneData: { ended: boolean; questionsAsked: number } | null = null;
      try {
        const res = await fetch(apiUrl(`/api/exams/${examId}/oral-attempt/${attemptId}/turn`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: message ?? undefined,
            forceEnd: opts?.forceEnd || undefined,
          }),
        });
        if (!res.ok || !res.body) {
          const d = await res.json().catch(() => ({}));
          setError(typeof d?.error === "string" ? d.error : "stream_failed");
          setProcessing(false);
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let leftover = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          leftover += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = leftover.indexOf("\n\n")) >= 0) {
            const raw = leftover.slice(0, idx);
            leftover = leftover.slice(idx + 2);
            let event = "message";
            const dataLines: string[] = [];
            for (const line of raw.split("\n")) {
              if (line.startsWith("event: ")) event = line.slice(7);
              else if (line.startsWith("data: ")) dataLines.push(line.slice(6));
            }
            const data = dataLines.join("\n");
            if (event === "delta") {
              acc += data;
              reveal.push(acc);
            } else if (event === "done") {
              try {
                doneData = JSON.parse(data);
              } catch {
                /* ignore */
              }
            } else if (event === "error") {
              try {
                setError((JSON.parse(data) as { code?: string }).code ?? "unknown");
              } catch {
                setError("unknown");
              }
            }
          }
        }
        if (acc) {
          finalizeRef.current = {
            examinerText: acc,
            questionsAsked: doneData?.questionsAsked,
            ended: doneData?.ended,
          };
        } else {
          setProcessing(false);
          if (doneData) {
            setQuestionsAsked(doneData.questionsAsked);
            if (doneData.ended) setEnded(true);
          }
        }
      } catch (e) {
        setError((e as Error).message || "stream_failed");
        setProcessing(false);
      }
    },
    [examId, attemptId, reveal],
  );

  useEffect(() => {
    if (kickedOff.current) return;
    if (initialTurns.length === 0) {
      kickedOff.current = true;
      void sendVoiceTurn(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ended) {
      const t = setTimeout(() => router.push(submittedUrl), 3_000);
      return () => clearTimeout(t);
    }
  }, [ended, router, submittedUrl]);

  useEffect(() => {
    let cancelled = false;
    const ping = () => {
      fetch(apiUrl(`/api/exam-attempts/${attemptId}/heartbeat`), { method: "POST" }).catch(
        () => undefined,
      );
    };
    ping();
    const t = setInterval(() => {
      if (!cancelled) ping();
    }, 10_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [attemptId]);

  useEffect(() => {
    const t = setInterval(() => {
      const r = Math.max(0, Math.floor((deadlineEpoch - (Date.now() + clockSkewMs)) / 1000));
      setRemainingSec(r);
      if (r <= 0) {
        clearInterval(t);
        const live = liveRef.current;
        if (!live.ended && !live.processing && !live.recording && live.turns.length > 0) {
          const finalMessage = live.input.trim() || "(Đã hết giờ, không kịp trả lời.)";
          setInput("");
          void sendTextTurn(finalMessage);
        }
      }
    }, 1_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadlineEpoch, clockSkewMs]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [turns, reveal.revealed]);

  useEffect(() => revokeQueuedUrls, [revokeQueuedUrls]);

  const logIncident = useCallback(
    async (type: string, payload?: Record<string, unknown>) => {
      try {
        await fetch(apiUrl(`/api/exam-attempts/${attemptId}/incidents`), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type, payload }),
        });
      } catch {
        // Best-effort — mất mạng tự nó đã là 1 dấu hiệu, không cần báo lỗi ở đây.
      }
    },
    [attemptId],
  );

  const canAnswer =
    !ended && !processing && turns.length > 0 && turns[turns.length - 1]!.role === "examiner";

  async function startRecording() {
    if (!canAnswer || recording) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        void sendVoiceTurn(blob);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      setError("mic_denied");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  function submitTyped() {
    const text = input.trim();
    if (!text || !canAnswer) return;
    setInput("");
    void sendTextTurn(text);
  }

  function endEarly() {
    if (!canAnswer) return;
    if (!confirm("Kết thúc buổi vấn đáp ngay bây giờ? Không thể tiếp tục sau khi kết thúc.")) {
      return;
    }
    setInput("");
    if (textFallback) void sendTextTurn(null, { forceEnd: true });
    else void sendVoiceTurn(null, { forceEnd: true });
  }

  const minutes = Math.floor(remainingSec / 60);
  const seconds = remainingSec % 60;
  const timerDanger = remainingSec < 120;

  const isListening = recording || (textFallback && input.trim().length > 0);
  const avatarState: OralAvatarState = ended
    ? "idle"
    : isListening
      ? "listening"
      : processing
        ? reveal.revealed
          ? "talking"
          : "thinking"
        : speaking
          ? "talking"
          : "idle";

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[rgb(var(--surface-muted))]">
      <FullscreenGate examTitle={examTitle} onEnter={() => undefined} required />
      <TabBlurWarning onBlur={() => logIncident("tab_blur")} />
      <MultiTabDetector
        attemptId={attemptId}
        onConflict={(peerTabId) => logIncident("multi_tab", { peerTabId })}
      />
      <audio ref={audioRef} className="hidden" />

      <header className="flex items-center justify-between gap-3 border-b border-token bg-[rgb(var(--surface))] px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (confirm("Rời phòng vấn đáp? Bài làm vẫn giữ nguyên, quay lại sau để tiếp tục.")) {
                router.push(exitUrl);
              }
            }}
            className="shrink-0 rounded-full p-1.5 text-faint hover:bg-[rgb(var(--surface-muted))] hover:text-ink"
            aria-label="Thoát phòng vấn đáp"
            title="Thoát phòng vấn đáp"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{examTitle}</p>
            <p className="truncate text-caption text-faint">{courseTitle}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-caption text-faint">
            Câu {Math.min(questionsAsked, MAX_ORAL_QUESTIONS)}/{MAX_ORAL_QUESTIONS}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium tabular-nums ${
              timerDanger ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"
            }`}
          >
            <Timer className="h-4 w-4" />
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        {/* "Sân khấu" — avatar AI giám khảo ở giữa, phông nền có glow tạo cảm
            giác đang đối diện trực tiếp (face-to-face) thay vì chỉ là 1 icon
            phụ trong panel bên cạnh. Hiện ở mọi kích thước màn hình. */}
        <div className="relative flex shrink-0 flex-col items-center justify-center gap-1.5 overflow-hidden border-b border-token bg-gradient-to-b from-brand-50 to-[rgb(var(--surface))] py-4 dark:from-slate-900 dark:to-[rgb(var(--surface))]">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-56 w-56 rounded-full bg-brand-300/30 blur-3xl dark:bg-brand-500/10 sm:h-80 sm:w-80" />
          </div>
          <div className="relative z-10">
            <OralAiAvatar state={avatarState} />
          </div>
          {instructionsHtml && (
            <button
              type="button"
              onClick={() => setShowInstructions(true)}
              className="relative z-10 inline-flex items-center gap-1.5 rounded-full border border-token bg-[rgb(var(--surface))]/90 px-3 py-1 text-xs font-medium text-faint hover:text-ink"
            >
              <Info className="h-3.5 w-3.5" />
              Xem hướng dẫn
            </button>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
            <div className="mx-auto max-w-2xl space-y-4">
              {turns.length === 0 && !processing && (
                <p className="text-center text-sm text-faint">Đang chuẩn bị câu hỏi đầu tiên…</p>
              )}
              {turns.map((t, i) => (
                <Bubble
                  key={i}
                  role={t.role}
                  content={t.content}
                  studentName={studentName}
                  studentImageUrl={studentImageUrl}
                />
              ))}
              {recording && (
                <div className="flex items-end justify-end gap-2">
                  <div className="rounded-2xl bg-sky-100 px-4 py-2.5 shadow-sm dark:bg-sky-900/40">
                    <span className="inline-flex gap-1" aria-hidden="true">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-500" style={{ animationDelay: "0ms" }} />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-500" style={{ animationDelay: "150ms" }} />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-500" style={{ animationDelay: "300ms" }} />
                    </span>
                  </div>
                  <UserAvatar
                    name={studentName}
                    imageUrl={studentImageUrl}
                    size="sm"
                    className="shrink-0"
                  />
                </div>
              )}
              {processing && reveal.revealed && (
                <Bubble role="examiner" content={reveal.revealed} typing />
              )}
              {processing && !reveal.revealed && (
                <div className="flex items-center gap-1.5 pl-1 text-xs italic text-faint">
                  <span className="inline-flex gap-0.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: "300ms" }} />
                  </span>
                  {textFallback ? "AI giám khảo đang soạn câu hỏi…" : "AI giám khảo đang nghe và soạn câu hỏi…"}
                </div>
              )}
              {speaking && (
                <p className="pl-1 text-xs italic text-faint">🔊 AI giám khảo đang đọc câu hỏi…</p>
              )}
              {ended && (
                <div className="banner-success px-4 py-3 text-sm">
                  Buổi vấn đáp đã kết thúc. Đang chuyển sang trang xác nhận…
                </div>
              )}
              {error && (
                <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                  {FRIENDLY_ERROR[error] ?? `Lỗi: ${error}`}
                </div>
              )}
            </div>
          </div>

          <footer className="border-t border-token bg-[rgb(var(--surface))] p-3 sm:p-4">
            <div className="mx-auto flex max-w-2xl flex-col gap-2">
              {textFallback ? (
                <div className="flex gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        submitTyped();
                      }
                    }}
                    disabled={!canAnswer}
                    rows={2}
                    placeholder={
                      ended
                        ? "Buổi vấn đáp đã kết thúc."
                        : canAnswer
                          ? "Trả lời câu hỏi... (Enter = gửi · Shift+Enter = xuống dòng)"
                          : "Đợi câu hỏi từ AI giám khảo…"
                    }
                    className="textarea flex-1 resize-none text-sm"
                  />
                  <button
                    onClick={submitTyped}
                    disabled={!canAnswer || !input.trim()}
                    className="btn-sm self-stretch inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
                  >
                    Gửi
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-2">
                  <div className="relative flex h-16 w-16 items-center justify-center">
                    {recording && (
                      <>
                        <span className="absolute inset-0 rounded-full bg-red-400/40 animate-avatar-listen-ring" />
                        <span
                          className="absolute inset-0 rounded-full bg-red-400/40 animate-avatar-listen-ring"
                          style={{ animationDelay: "0.8s" }}
                        />
                      </>
                    )}
                    <button
                      onClick={recording ? stopRecording : startRecording}
                      disabled={!canAnswer && !recording}
                      className={`relative z-10 flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        recording ? "bg-red-600 hover:bg-red-700" : "bg-brand-600 hover:bg-brand-700"
                      }`}
                      aria-label={recording ? "Dừng ghi âm và gửi" : "Bắt đầu ghi âm câu trả lời"}
                    >
                      {recording ? <Square className="h-6 w-6" /> : <Mic className="h-7 w-7" />}
                    </button>
                  </div>
                  {recording ? (
                    <p className="flex items-center gap-1.5 text-xs font-medium text-red-600">
                      <span className="inline-flex gap-0.5" aria-hidden="true">
                        <span className="h-1 w-1 animate-bounce rounded-full bg-red-500" style={{ animationDelay: "0ms" }} />
                        <span className="h-1 w-1 animate-bounce rounded-full bg-red-500" style={{ animationDelay: "150ms" }} />
                        <span className="h-1 w-1 animate-bounce rounded-full bg-red-500" style={{ animationDelay: "300ms" }} />
                      </span>
                      Đang nghe — bấm lại để dừng và gửi câu trả lời.
                    </p>
                  ) : (
                    <p className="text-xs text-faint">
                      {ended
                        ? "Buổi vấn đáp đã kết thúc."
                        : canAnswer
                          ? "Bấm micro để trả lời."
                          : "Đợi câu hỏi từ AI giám khảo…"}
                    </p>
                  )}
                </div>
              )}
              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => setTextFallback((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs text-faint underline underline-offset-2 hover:text-ink"
                >
                  <Keyboard className="h-3.5 w-3.5" />
                  {textFallback ? "Chuyển lại sang nói" : "Mic hỏng? Chuyển sang gõ chữ"}
                </button>
                <button
                  type="button"
                  onClick={endEarly}
                  disabled={!canAnswer}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[rgb(var(--text-muted))] underline underline-offset-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Kết thúc buổi vấn đáp
                </button>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {showInstructions && instructionsHtml && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowInstructions(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-lg bg-[rgb(var(--surface))] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Hướng dẫn</h2>
              <button
                type="button"
                onClick={() => setShowInstructions(false)}
                className="rounded p-1 text-faint hover:bg-[rgb(var(--surface-muted))] hover:text-ink"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <SafeHtml html={instructionsHtml} className="prose prose-sm max-w-none dark:prose-invert" />
          </div>
        </div>
      )}
    </div>
  );
}

function Bubble({
  role,
  content,
  typing,
  studentName,
  studentImageUrl,
}: {
  role: "student" | "examiner";
  content: string;
  typing?: boolean;
  studentName?: string | null;
  studentImageUrl?: string | null;
}) {
  const isStudent = role === "student";
  return (
    <div className={`flex items-end gap-2 ${isStudent ? "justify-end" : "justify-start"}`}>
      {!isStudent && (
        <img
          src="/oral-avatar/idle-poster.png"
          alt="AI giám khảo"
          className="h-8 w-8 shrink-0 rounded-full object-cover shadow-sm"
        />
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
          isStudent
            ? "bg-sky-100 text-slate-800 dark:bg-sky-900/40 dark:text-sky-100"
            : "border border-token bg-[rgb(var(--surface))] text-[rgb(var(--text))]"
        }`}
      >
        <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
        {typing && <span className="ml-1 animate-pulse text-brand-500">▌</span>}
      </div>
      {isStudent && (
        <UserAvatar name={studentName} imageUrl={studentImageUrl} size="sm" className="shrink-0" />
      )}
    </div>
  );
}
