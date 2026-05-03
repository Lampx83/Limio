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

  // Load history when panel opens.
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

  // Auto-scroll to bottom on new content.
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

    // Optimistic user message.
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
        // Parse SSE events: each event ends with \n\n.
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
              // ignore
            }
          } else if (event === "delta") {
            acc += data;
            setStreamBuffer(acc);
          } else if (event === "done") {
            try {
              setUsage(JSON.parse(data));
            } catch {
              // ignore
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
        className="fixed bottom-6 right-6 z-30 rounded-full bg-violet-600 px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-violet-700"
      >
        💬 AI Tutor
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-30 flex h-[70vh] w-[380px] max-w-[calc(100vw-2rem)] flex-col rounded-lg border border-slate-300 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <p className="text-sm font-semibold">💬 AI Tutor</p>
        <button
          onClick={() => setOpen(false)}
          className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          aria-label="Đóng"
        >
          ✕
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3 text-sm">
        {messages.length === 0 && !streaming && (
          <p className="text-xs text-slate-500">
            Hỏi tôi bất cứ điều gì về bài học. Tôi sẽ gợi ý từng bước, không
            đưa thẳng đáp án bài tập.
          </p>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} role={m.role} content={m.content} />
        ))}
        {streaming && streamBuffer && (
          <MessageBubble role="assistant" content={streamBuffer} streaming />
        )}
        {streaming && !streamBuffer && (
          <p className="text-xs italic text-slate-500">AI đang nghĩ...</p>
        )}
        {error && (
          <p className="rounded bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
            Lỗi: {error}
            {error === "openai_not_configured" &&
              " — admin chưa cấu hình OpenAI key ở /admin/integrations."}
            {error === "rate_limited" &&
              " — bạn đã hỏi quá nhiều trong 1 giờ, đợi chút nhé."}
            {error === "daily_token_cap" &&
              " — đã hết quota AI hôm nay, thử lại ngày mai."}
          </p>
        )}
      </div>

      <footer className="border-t border-slate-200 p-2 dark:border-slate-800">
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
            placeholder="Hỏi AI tutor... (Enter = gửi, Shift+Enter = xuống dòng)"
            className="flex-1 resize-none rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          <button
            onClick={send}
            disabled={streaming || !input.trim()}
            className="rounded bg-violet-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50 hover:bg-violet-700"
          >
            Gửi
          </button>
        </div>
        {usage && (
          <p className="mt-1 text-[10px] text-slate-500">
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
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? "bg-violet-600 text-white"
            : "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
        }`}
      >
        <p className="whitespace-pre-wrap">{content}</p>
        {streaming && <span className="ml-1 animate-pulse">▌</span>}
      </div>
    </div>
  );
}
