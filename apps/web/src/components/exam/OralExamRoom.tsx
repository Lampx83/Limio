"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Timer } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import FullscreenGate from "./FullscreenGate";
import TabBlurWarning from "./TabBlurWarning";
import MultiTabDetector from "./MultiTabDetector";

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
}

const FRIENDLY_ERROR: Record<string, string> = {
  openai_not_configured: "Admin chưa cấu hình OpenAI key — báo giảng viên/admin.",
  rate_limited: "Bạn thao tác quá nhanh, đợi một chút rồi thử lại.",
  global_token_cap: "Hệ thống đã chạm trần AI hôm nay — báo giảng viên, đây không phải lỗi của bạn.",
};

export default function OralExamRoom({
  examId,
  attemptId,
  examTitle,
  courseTitle,
  startedAt,
  durationSec,
  serverNow,
  initialTurns,
  submittedUrl,
}: Props) {
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>(initialTurns);
  const [questionsAsked, setQuestionsAsked] = useState(
    initialTurns.filter((t) => t.role === "examiner").length,
  );
  const [ended, setEnded] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState("");
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const kickedOff = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Đọc trạng thái mới nhất bên trong interval hết giờ mà không phải liệt
  // kê turns/ended/input/streaming vào dependency array (tick lại mỗi giây).
  const liveRef = useRef({ turns, ended, input, streaming });
  liveRef.current = { turns, ended, input, streaming };

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

  const sendTurn = useCallback(
    async (message: string | null) => {
      setError(null);
      setStreaming(true);
      setStreamBuffer("");
      if (message !== null) {
        setTurns((prev) => [...prev, { role: "student", content: message }]);
      }

      let acc = "";
      let doneData: { ended: boolean; questionsAsked: number } | null = null;
      try {
        const res = await fetch(
          apiUrl(`/api/exams/${examId}/oral-attempt/${attemptId}/turn`),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: message ?? undefined }),
          },
        );
        if (!res.ok || !res.body) {
          const d = await res.json().catch(() => ({}));
          setError(typeof d?.error === "string" ? d.error : "stream_failed");
          setStreaming(false);
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
              setStreamBuffer(acc);
            } else if (event === "done") {
              try {
                doneData = JSON.parse(data);
              } catch {
                /* ignore */
              }
            } else if (event === "error") {
              try {
                const parsed = JSON.parse(data);
                setError(parsed.code ?? "unknown");
              } catch {
                setError("unknown");
              }
            }
          }
        }
      } catch (e) {
        setError((e as Error).message || "stream_failed");
      }

      if (acc) {
        setTurns((prev) => [...prev, { role: "examiner", content: acc }]);
      }
      setStreamBuffer("");
      setStreaming(false);
      if (doneData) {
        setQuestionsAsked(doneData.questionsAsked);
        if (doneData.ended) setEnded(true);
      }
    },
    [examId, attemptId],
  );

  // Lượt đầu tiên: AI đặt câu hỏi mở màn, KHÔNG có câu trả lời của sinh viên
  // đi kèm — runOralExamTurn yêu cầu message=null khi chưa có turn nào.
  useEffect(() => {
    if (kickedOff.current) return;
    if (initialTurns.length === 0) {
      kickedOff.current = true;
      void sendTurn(null);
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
    const t = setInterval(() => {
      const r = Math.max(
        0,
        Math.floor((deadlineEpoch - (Date.now() + clockSkewMs)) / 1000),
      );
      setRemainingSec(r);
      if (r <= 0) {
        clearInterval(t);
        // Hết giờ giữa chừng: gửi nốt câu trả lời đang gõ dở (hoặc một câu
        // báo hết giờ) để buổi thi được đóng đúng qua runOralExamTurn, thay
        // vì treo mãi ở in_progress. Chỉ làm khi đã có ít nhất 1 câu hỏi và
        // chưa đang chờ 1 lượt khác chạy (turns rỗng/đang streaming nghĩa là
        // lượt mở màn còn đang chạy/lỗi — không có gì hợp lệ để gửi kèm).
        const live = liveRef.current;
        if (!live.ended && !live.streaming && live.turns.length > 0) {
          const finalMessage = live.input.trim() || "(Đã hết giờ, không kịp trả lời.)";
          setInput("");
          void sendTurn(finalMessage);
        }
      }
    }, 1_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadlineEpoch, clockSkewMs]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns, streamBuffer]);

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
    !ended &&
    !streaming &&
    turns.length > 0 &&
    turns[turns.length - 1]!.role === "examiner";

  function submit() {
    const text = input.trim();
    if (!text || !canAnswer) return;
    setInput("");
    void sendTurn(text);
  }

  const minutes = Math.floor(remainingSec / 60);
  const seconds = remainingSec % 60;
  const timerDanger = remainingSec < 120;

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-[rgb(var(--surface-muted))]">
      <FullscreenGate examTitle={examTitle} onEnter={() => undefined} required />
      <TabBlurWarning onBlur={() => logIncident("tab_blur")} />
      <MultiTabDetector
        attemptId={attemptId}
        onConflict={(peerTabId) => logIncident("multi_tab", { peerTabId })}
      />

      <header className="flex items-center justify-between gap-3 border-b border-token bg-[rgb(var(--surface))] px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{examTitle}</p>
          <p className="truncate text-caption text-faint">{courseTitle}</p>
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

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {turns.length === 0 && !streaming && (
            <p className="text-center text-sm text-faint">Đang chuẩn bị câu hỏi đầu tiên…</p>
          )}
          {turns.map((t, i) => (
            <Bubble key={i} role={t.role} content={t.content} />
          ))}
          {streaming && streamBuffer && <Bubble role="examiner" content={streamBuffer} typing />}
          {streaming && !streamBuffer && (
            <div className="flex items-center gap-1.5 pl-1 text-xs italic text-faint">
              <span className="inline-flex gap-0.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: "300ms" }} />
              </span>
              AI giám khảo đang soạn câu hỏi…
            </div>
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
        <div className="mx-auto flex max-w-2xl gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
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
            onClick={submit}
            disabled={!canAnswer || !input.trim()}
            className="btn-sm self-stretch inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            Gửi
          </button>
        </div>
      </footer>
    </div>
  );
}

function Bubble({
  role,
  content,
  typing,
}: {
  role: "student" | "examiner";
  content: string;
  typing?: boolean;
}) {
  const isStudent = role === "student";
  return (
    <div className={isStudent ? "flex justify-end" : "flex justify-start"}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
          isStudent
            ? "bg-brand-gradient text-white"
            : "border border-token bg-[rgb(var(--surface))] text-[rgb(var(--text))]"
        }`}
      >
        <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
        {typing && <span className="ml-1 animate-pulse text-brand-500">▌</span>}
      </div>
    </div>
  );
}
