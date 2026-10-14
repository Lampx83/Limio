"use client";

import { Bot, Check, Copy, Maximize2, Minimize2, Quote, SendHorizontal, Sparkles, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FabTip } from "./lesson/TeacherBar";

import { useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { useAiTokensPageUnlocked } from "./AiTokensPageContext";

interface Message {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  createdAt: string | Date;
}

const SUGGESTIONS = [
  "Tóm tắt các ý chính của bài này",
  "Giải thích lại đơn giản hơn cho mình",
  "Cho mình một câu hỏi để tự kiểm tra",
];

/**
 * Tách phần trích dẫn đứng đầu tin nhắn ("> đoạn bôi đen") khỏi câu hỏi. Server
 * lưu trích đoạn chung với tin nhắn để lịch sử hội thoại còn nguyên ngữ cảnh,
 * nên giao diện phải tự tách ra khi vẽ.
 */
function splitQuote(content: string): { quote: string | null; text: string } {
  const lines = content.split("\n");
  const q: string[] = [];
  while (lines.length && lines[0]?.startsWith("> ")) q.push(lines.shift()!.slice(2));
  if (!q.length) return { quote: null, text: content };
  return { quote: q.join("\n"), text: lines.join("\n").replace(/^\n+/, "") };
}

export default function AiTutorPanel({ lessonId }: { lessonId: string }) {
  const tokensUnlocked = useAiTokensPageUnlocked();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  // Đoạn bôi đen trong bài đang đính kèm câu hỏi kế tiếp ("Hỏi AI").
  const [quote, setQuote] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [budget, setBudget] = useState<{
    estimatedTurns: number;
    total: number;
    purchased: number;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Nạp số dư khi mở panel và sau mỗi lượt. Chính lời gọi này cũng là lúc hạn
  // mức tháng được cấp, nên mở panel đầu tháng là đã thấy quota mới.
  const refreshBudget = async () => {
    const r = await fetch(apiUrl("/api/ai/budget"));
    if (r.ok) setBudget(await r.json());
  };
  // B11 — người học bấm "hỏi thêm" ở trang kết quả thì tới đây kèm sẵn câu hỏi.
  // Mở khung và điền sẵn, nhưng KHÔNG tự gửi: gửi hộ là tiêu token của họ mà
  // chưa hỏi, và họ mất cơ hội sửa lại câu hỏi cho đúng ý mình.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const seeded = new URLSearchParams(window.location.search).get("hoi");
    if (!seeded) return;
    setOpen(true);
    setInput(seeded);
    const url = new URL(window.location.href);
    url.searchParams.delete("hoi");
    window.history.replaceState({}, "", url.toString());
  }, []);

  // "Hỏi AI" từ vùng bôi đen trong bài (LessonAnnotations). Cùng nguyên tắc như
  // trên: mở khung, đính trích đoạn, để người học tự gõ câu hỏi rồi mới gửi.
  useEffect(() => {
    const onAsk = (e: Event) => {
      const q = (e as CustomEvent<{ quote?: string }>).detail?.quote?.trim();
      if (!q) return;
      setQuote(q);
      setOpen(true);
      setTimeout(() => inputRef.current?.focus(), 80);
    };
    window.addEventListener("limio:ask-ai", onAsk);
    return () => window.removeEventListener("limio:ask-ai", onAsk);
  }, []);

  useEffect(() => {
    if (!open) return;
    void refreshBudget();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || conversationId) return;
    void (async () => {
      const r = await fetch(apiUrl(`/api/ai/conversations/by-lesson/${lessonId}`));
      if (!r.ok) {
        setError("conversation_load_failed");
        return;
      }
      const d = await r.json();
      setConversationId(d.conversation.id);
      setMessages(
        ((d.conversation.messages ?? []) as Message[]).filter((m) => m.role !== "system"),
      );
    })();
  }, [open, conversationId, lessonId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamBuffer]);

  // Ô nhập tự cao theo nội dung, tối đa ~6 dòng.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }, [input, open]);

  async function send(override?: string) {
    const text = (override ?? input).trim();
    if (!text || streaming) return;
    const attached = quote;
    setError(null);
    setStreaming(true);
    setStreamBuffer("");

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      // Cùng định dạng server lưu, để tin nhắn không đổi hình khi tải lại.
      content: attached
        ? `${attached.split("\n").map((l) => `> ${l}`).join("\n")}\n\n${text}`
        : text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setQuote(null);

    let acc = "";
    try {
      const res = await fetch(apiUrl("/api/ai/tutor"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId,
          message: text,
          conversationId,
          ...(attached ? { quote: attached } : {}),
        }),
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
    void refreshBudget();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Mở trợ giảng AI"
        title="Trợ giảng AI — hỏi lại phần chưa hiểu trong bài"
        /*
          Nút tròn 44px, xếp thành cột nút nổi bên phải cùng nút ghi chú và nút
          giảng viên: ba nút cùng cỡ, cùng lề phải, cách đều nhau. Trước đây đây
          là một viên thuốc có chữ, to hơn hẳn hai nút kia và lệch lề — nhìn như
          ba thứ không liên quan xếp cạnh nhau.
        */
        className="group fixed bottom-20 right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-brand-gradient text-white shadow-brand-glow transition-transform hover:scale-105"
      >
        <Bot size={20} />
        <FabTip>Trợ giảng AI</FabTip>
      </button>
    );
  }

  const empty = messages.length === 0 && !streaming;

  return (
    <div
      role="dialog"
      aria-label="Trợ giảng AI"
      /*
        Dưới sm: tờ trượt gần toàn màn hình (chừa mép trên để còn thấy mình đang
        ở bài nào). Từ sm: cửa sổ nổi góc dưới phải, có chế độ mở rộng để đọc
        câu trả lời dài mà không phải cuộn trong một khung 400px.
      */
      className={`fixed inset-x-0 bottom-0 top-10 z-40 flex flex-col overflow-hidden rounded-t-2xl border border-token bg-[rgb(var(--surface))] shadow-card-hover animate-fade-in-up sm:inset-x-auto sm:bottom-6 sm:right-6 sm:top-auto sm:rounded-2xl ${
        expanded
          ? "sm:h-[calc(100vh-3rem)] sm:w-[min(760px,calc(100vw-3rem))]"
          : "sm:h-[min(78vh,720px)] sm:w-[460px]"
      }`}
    >
      <header className="flex items-center gap-3 border-b border-token bg-[rgb(var(--surface))] px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-sm">
          <Sparkles size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-tight">Trợ giảng AI</p>
          <p className="truncate text-xs text-muted">
            {budget
              ? `Còn khoảng ${budget.estimatedTurns} lượt hỏi tháng này`
              : "Hỏi về nội dung bài đang học"}
          </p>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="hidden h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))] sm:flex"
          aria-label={expanded ? "Thu nhỏ" : "Mở rộng"}
          title={expanded ? "Thu nhỏ" : "Mở rộng"}
        >
          {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))]"
          aria-label="Đóng"
        >
          <X size={18} />
        </button>
      </header>

      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        className="flex-1 space-y-5 overflow-y-auto bg-[rgb(var(--surface-muted))/0.45] px-4 py-5"
      >
        {empty && (
          <div className="mx-auto max-w-sm pt-4 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-brand-glow">
              <Sparkles size={22} />
            </span>
            <h3 className="mt-3 text-base font-semibold">Bạn đang vướng chỗ nào?</h3>
            <p className="mt-1 text-sm text-muted">
              Mình sẽ gợi ý từng bước để bạn tự hiểu, không đưa thẳng đáp án bài
              tập. Mẹo: bôi đen một đoạn trong bài, bấm chuột phải rồi chọn
              “Hỏi AI”.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="rounded-xl border border-token bg-[rgb(var(--surface))] px-3.5 py-2.5 text-left text-sm transition-colors hover:border-brand-500 hover:bg-[rgb(var(--surface-muted))]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} role={m.role} content={m.content} />
        ))}
        {streaming && streamBuffer && (
          <MessageBubble role="assistant" content={streamBuffer} streaming />
        )}
        {streaming && !streamBuffer && (
          <div className="flex items-end gap-2.5">
            <AssistantAvatar />
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-token bg-[rgb(var(--surface))] px-4 py-3 shadow-sm">
              {[0, 150, 300].map((d) => (
                <span
                  key={d}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-500"
                  style={{ animationDelay: `${d}ms` }}
                />
              ))}
            </div>
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-danger-100 bg-danger-50 p-3 text-sm text-danger-700">
            <ErrorMessage code={error} tokensUnlocked={tokensUnlocked} />
          </div>
        )}
      </div>

      <footer className="border-t border-token bg-[rgb(var(--surface))] p-3">
        {quote && (
          <div className="mb-2 flex items-start gap-2 rounded-xl border border-token bg-[rgb(var(--surface-muted))] px-3 py-2">
            <Quote size={14} className="mt-0.5 shrink-0 text-brand-600" />
            <p className="line-clamp-2 min-w-0 flex-1 text-xs italic text-muted">{quote}</p>
            <button
              type="button"
              onClick={() => setQuote(null)}
              aria-label="Bỏ đoạn trích"
              className="shrink-0 rounded p-0.5 text-faint hover:text-[rgb(var(--text))]"
            >
              <X size={14} />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2 rounded-2xl border border-token bg-[rgb(var(--surface))] p-1.5 pl-3 transition-shadow focus-within:border-brand-500 focus-within:shadow-[0_0_0_3px_rgb(var(--brand)/0.15)]">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send();
              }
            }}
            disabled={streaming}
            rows={1}
            placeholder={quote ? "Bạn muốn hỏi gì về đoạn này?" : "Hỏi về bài học…"}
            className="max-h-36 min-h-[36px] flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-[rgb(var(--text-faint))] disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={streaming || !input.trim()}
            aria-label="Gửi"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:opacity-40"
          >
            <SendHorizontal size={17} />
          </button>
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-faint">
          Enter để gửi · Shift+Enter xuống dòng · AI có thể nhầm, hãy đối chiếu với bài học.
        </p>
      </footer>
    </div>
  );
}

function ErrorMessage({ code, tokensUnlocked }: { code: string; tokensUnlocked: boolean }) {
  switch (code) {
    case "openai_not_configured":
      return <p>Trợ giảng AI chưa được cấu hình. Báo quản trị viên kiểm tra ở /admin/integrations.</p>;
    case "openai_busy":
      return <p>Hệ thống AI đang quá tải, đợi vài giây rồi hỏi lại nhé.</p>;
    case "rate_limited":
      return <p>Bạn đã hỏi quá nhiều trong 1 giờ, đợi chút nhé.</p>;
    case "no_token_budget":
      return (
        <p>
          Bạn đã dùng hết lượt hỏi của tháng này. Hạn mức được cấp lại vào đầu tháng sau.
          {tokensUnlocked && (
            <>
              {" "}
              <a href={apiUrl("/me/ai-tokens")} className="link underline">
                Mua thêm lượt
              </a>{" "}
              nếu cần dùng ngay.
            </>
          )}
        </p>
      );
    case "global_token_cap":
      return (
        <p>
          Cả hệ thống đã chạm trần AI hôm nay. Đây là hạn mức chung, không phải lỗi của bạn
          — báo giảng viên hoặc thử lại ngày mai.
        </p>
      );
    case "not_enrolled":
      return <p>Bạn cần ghi danh khoá học này để hỏi trợ giảng AI.</p>;
    default:
      return (
        <p>
          Không gửi được câu hỏi. Thử lại sau ít phút.{" "}
          <span className="text-xs opacity-70">({code})</span>
        </p>
      );
  }
}

function AssistantAvatar() {
  return (
    <span className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-gradient text-white">
      <Sparkles size={14} />
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label="Sao chép câu trả lời"
      title="Sao chép"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
      className="mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-faint opacity-0 transition-opacity hover:text-[rgb(var(--text))] focus-visible:opacity-100 group-hover/msg:opacity-100"
    >
      {done ? <Check size={12} /> : <Copy size={12} />}
      {done ? "Đã chép" : "Sao chép"}
    </button>
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
  if (role === "user") {
    const { quote, text } = splitQuote(content);
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-gradient px-3.5 py-2.5 text-sm text-white shadow-sm">
          {quote && (
            <p className="mb-2 line-clamp-4 whitespace-pre-wrap border-l-2 border-white/60 pl-2.5 text-xs italic opacity-90">
              {quote}
            </p>
          )}
          <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="group/msg flex items-end gap-2.5">
      <AssistantAvatar />
      <div className="min-w-0 max-w-[88%]">
        <div className="rounded-2xl rounded-bl-md border border-token bg-[rgb(var(--surface))] px-4 py-3 text-sm shadow-sm">
          {/* Mô hình được dặn trả lời bằng markdown (list, code block). react-markdown
              không render HTML thô theo mặc định nên an toàn với nội dung do model sinh. */}
          <div className="prose prose-sm max-w-none leading-relaxed prose-p:my-2 prose-pre:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 first:prose-p:mt-0 last:prose-p:mb-0">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
          {streaming && <span className="animate-pulse text-brand-500">▌</span>}
        </div>
        {!streaming && <CopyButton text={content} />}
      </div>
    </div>
  );
}
