"use client";

import { useEffect, useRef, useState } from "react";

interface Message {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  createdAt: string | Date;
}

export default function AiTutorPanel({ lessonId }: { lessonId: string }) {
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<{
    tokensInput: number;
    tokensOutput: number;
    costUsd: number;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || conversationId) return;
    void (async () => {
      const r = await fetch(`/api/ai/conversations/by-lesson/${lessonId}`);
      if (!r.ok) {
        setError("conversation_load_failed");
        return;
      }
      const d = await r.json();
      setConversationId(d.conversation.id);
      setMessages(d.conversation.messages ?? []);
    })();
  }, [open, conversationId, lessonId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamBuffer]);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setError(null);
    setStreaming(true);
    setStreamBuffer("");

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    let acc = "";
    try {
      const res = await fetch("/api/ai/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, message: text, conversationId }),
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "stream_failed");
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
        let idx;
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
          if (event === "meta") {
            try {
              const parsed = JSON.parse(data);
              if (parsed.conversationId) setConversationId(parsed.conversationId);
            } catch {
              /* ignore */
            }
          } else if (event === "delta") {
            acc += data;
            setStreamBuffer(acc);
          } else if (event === "done") {
            try {
              setUsage(JSON.parse(data));
            } catch {
              /* ignore */
            }
          } else if (event === "error") {
            try {
              const parsed = JSON.parse(data);
              setError(parsed.code ?? "unknown_error");
            } catch {
              setError("unknown_error");
            }
          }
        }
      }
    } catch (e) {
      setError((e as Error).message ?? "stream_failed");
    }

    if (acc) {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: acc,
          createdAt: new Date().toISOString(),
        },
      ]);
    }
    setStreamBuffer("");
    setStreaming(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-full bg-brand-gradient px-5 py-3 text-sm font-semibold text-white shadow-brand-glow transition-all hover:scale-105"
      >
        💬 AI Tutor
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-30 flex h-[70vh] w-[400px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))] shadow-card-hover animate-fade-in-up">
      <header className="flex items-center justify-between gap-2 bg-brand-gradient px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-sm backdrop-blur">
            💬
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight">AI Tutor</p>
            <p className="text-xs opacity-80">Hỏi gì cũng được</p>
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="flex h-7 w-7 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/20 hover:text-white"
          aria-label="Đóng"
        >
          ✕
        </button>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto bg-[rgb(var(--surface-muted))/0.4] px-3 py-3 text-sm"
      >
        {messages.length === 0 && !streaming && (
          <div className="rounded-xl border border-dashed border-token bg-[rgb(var(--surface))] p-3 text-xs text-muted">
            Hỏi tôi bất cứ điều gì về bài học. Tôi sẽ gợi ý từng bước, không
            đưa thẳng đáp án bài tập.
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} role={m.role} content={m.content} />
        ))}
        {streaming && streamBuffer && (
          <MessageBubble role="assistant" content={streamBuffer} streaming />
        )}
        {streaming && !streamBuffer && (
          <div className="flex items-center gap-1.5 text-xs italic text-faint">
            <span className="inline-flex gap-0.5">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: "0ms" }} />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: "150ms" }} />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: "300ms" }} />
            </span>
            AI đang nghĩ...
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-danger-100 bg-danger-50 p-3 text-xs text-danger-700">
            <p className="font-semibold">Lỗi: {error}</p>
            {error === "openai_not_configured" && (
              <p className="mt-1">Admin chưa cấu hình OpenAI key ở /admin/integrations.</p>
            )}
            {error === "rate_limited" && (
              <p className="mt-1">Bạn đã hỏi quá nhiều trong 1 giờ, đợi chút nhé.</p>
            )}
            {error === "daily_token_cap" && (
              <p className="mt-1">Đã hết quota AI hôm nay, thử lại ngày mai.</p>
            )}
          </div>
        )}
      </div>

      <footer className="border-t border-token bg-[rgb(var(--surface))] p-3">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            disabled={streaming}
            rows={2}
            placeholder="Hỏi AI tutor... (Enter = gửi · Shift+Enter = xuống dòng)"
            className="textarea flex-1 resize-none text-sm"
          />
          <button
            onClick={send}
            disabled={streaming || !input.trim()}
            className="btn-sm self-stretch inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            ↗
          </button>
        </div>
        {usage && (
          <p className="mt-1.5 text-[10px] text-faint">
            ↳ {usage.tokensInput} in / {usage.tokensOutput} out · ${usage.costUsd.toFixed(5)}
          </p>
        )}
      </footer>
    </div>
  );
}

function MessageBubble({
  role,
  content,
  streaming,
}: {
  role: string;
  content: string;
  streaming?: boolean;
}) {
  const isUser = role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
          isUser
            ? "bg-brand-gradient text-white"
            : "bg-[rgb(var(--surface))] border border-token text-[rgb(var(--text))]"
        }`}
      >
        <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
        {streaming && <span className="ml-1 animate-pulse text-brand-500">▌</span>}
      </div>
    </div>
  );
}
