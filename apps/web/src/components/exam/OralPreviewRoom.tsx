"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

interface Turn {
  role: "examiner" | "student";
  content: string;
}

const ERROR_LABEL: Record<string, string> = {
  openai_not_configured: "Chưa cấu hình khoá OpenAI trên hệ thống.",
  forbidden: "Bạn không có quyền thử đề này.",
  history_too_long: "Hội thoại thử quá dài — hãy thử lại từ đầu.",
};

/**
 * Phòng "Thử vấn đáp" của giáo viên: chat văn bản với AI giám khảo theo đúng cấu hình đề (ngôn ngữ, hướng dẫn,
 * tài liệu). Hội thoại CHỈ nằm trong bộ nhớ trình duyệt này — không có lượt thi, không lưu, không chấm điểm;
 * tải lại trang là mất. Mỗi lượt vẫn gọi AI thật nên tốn token của giáo viên.
 */
export default function OralPreviewRoom({ examId }: { examId: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [ended, setEnded] = useState(false);
  const [questionsAsked, setQuestionsAsked] = useState(0);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, streamText]);

  const sendTurn = useCallback(
    async (history: Turn[], message: string | null, forceEnd = false) => {
      setError(null);
      setStreaming(true);
      setStreamText("");
      let acc = "";
      let done: { ended: boolean; questionsAsked: number } | null = null;
      try {
        const res = await fetch(apiUrl(`/api/exams/${examId}/oral-preview/turn`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ history, message: message ?? undefined, forceEnd: forceEnd || undefined }),
        });
        if (!res.ok || !res.body) {
          const d = await res.json().catch(() => ({}));
          setError(ERROR_LABEL[d?.error] ?? d?.error ?? "Không gọi được AI.");
          setStreaming(false);
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let leftover = "";
        while (true) {
          const { done: finished, value } = await reader.read();
          if (finished) break;
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
              setStreamText(acc);
            } else if (event === "done") {
              try {
                done = JSON.parse(data);
              } catch {
                /* bỏ qua */
              }
            } else if (event === "error") {
              try {
                const parsed = JSON.parse(data);
                setError(ERROR_LABEL[parsed.code] ?? `Lỗi AI: ${parsed.code ?? "unknown"}`);
              } catch {
                setError("Lỗi AI.");
              }
            }
          }
        }
      } catch (e) {
        setError((e as Error).message || "Mất kết nối.");
      }
      if (acc) setTurns((prev) => [...prev, { role: "examiner", content: acc }]);
      setStreamText("");
      setStreaming(false);
      if (done) {
        setQuestionsAsked(done.questionsAsked);
        if (done.ended) setEnded(true);
      }
    },
    [examId],
  );

  const start = () => {
    setStarted(true);
    void sendTurn([], null);
  };

  const submit = () => {
    const text = draft.trim();
    if (!text || streaming || ended) return;
    const history = turns;
    setTurns([...history, { role: "student", content: text }]);
    setDraft("");
    void sendTurn(history, text);
  };

  const finish = () => {
    if (streaming || ended || turns.length === 0) return;
    void sendTurn(turns, null, true);
  };

  const reset = () => {
    setTurns([]);
    setStreamText("");
    setEnded(false);
    setQuestionsAsked(0);
    setStarted(false);
    setError(null);
    setDraft("");
  };

  if (!started) {
    return (
      <div className="rounded-2xl border border-token bg-[rgb(var(--surface))] p-8 text-center">
        <p className="mb-1 text-h4">Sẵn sàng thử?</p>
        <p className="mb-5 text-sm text-faint">
          AI sẽ hỏi bạn như hỏi sinh viên. Bạn trả lời như một sinh viên để xem cách AI đặt câu hỏi.
        </p>
        <button onClick={start} className="btn btn-primary">
          Bắt đầu thử
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-token bg-[rgb(var(--surface))]">
      <ul className="max-h-[60vh] space-y-3 overflow-y-auto p-4">
        {turns.map((t, i) => (
          <li key={i} className={t.role === "examiner" ? "flex justify-start" : "flex justify-end"}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                t.role === "examiner"
                  ? "border border-token bg-[rgb(var(--surface))] text-[rgb(var(--text))]"
                  : "bg-lime-100 text-slate-800 dark:bg-lime-900/40 dark:text-lime-100"
              }`}
            >
              <p className="mb-0.5 text-caption font-medium opacity-70">
                {t.role === "examiner" ? "AI giám khảo" : "Bạn (đóng vai sinh viên)"}
              </p>
              {t.content}
            </div>
          </li>
        ))}
        {streaming && (
          <li className="flex justify-start">
            <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl border border-token px-4 py-2.5 text-sm shadow-sm">
              <p className="mb-0.5 text-caption font-medium opacity-70">AI giám khảo</p>
              {streamText || "…"}
            </div>
          </li>
        )}
        <div ref={bottomRef} />
      </ul>

      {error && <p className="banner-danger mx-4 mb-3 px-3 py-2 text-sm">{error}</p>}

      <div className="border-t border-token p-4">
        {ended ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-faint">Buổi thử đã kết thúc ({questionsAsked} câu hỏi). Hội thoại này không được lưu.</p>
            <button onClick={reset} className="btn btn-secondary btn-sm">
              Thử lại từ đầu
            </button>
          </div>
        ) : (
          <>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              disabled={streaming}
              rows={3}
              placeholder="Gõ câu trả lời (Enter để gửi, Shift+Enter xuống dòng)"
              className="w-full rounded border border-default px-3 py-2 text-sm disabled:bg-slate-50"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-caption text-faint">Câu hỏi thứ {Math.max(questionsAsked, 1)}</p>
              <div className="flex gap-2">
                <button onClick={finish} disabled={streaming || turns.length === 0} className="btn btn-secondary btn-sm">
                  Kết thúc thử
                </button>
                <button onClick={submit} disabled={streaming || !draft.trim()} className="btn btn-primary btn-sm">
                  Gửi
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
