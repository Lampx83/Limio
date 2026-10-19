"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Brush,
  CalendarCheck,
  Cloud,
  FileText,
  FlaskConical,
  Gamepad2,
  Library,
  MessageSquare,
  PenTool,
  Presentation,
  Shuffle,
  SendHorizontal,
  Sparkles,
  StickyNote,
  BarChart3,
  Bot,
  BookOpen,
  Brain,
  ClipboardList,
  Clock,
  Trophy,
  UserX,
  Users,
  type LucideIcon,
} from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { LimeSliceIcon } from "./BrandIcons";
// Chỉ import kiểu: teacherAssistant.ts kéo theo cả chuỗi limioLiveChat (phía server), không để vào bundle trình duyệt.
import type { AssistantAction, AssistantIcon, AssistantReply, AssistantStarter } from "@/lib/teacherAssistant";

/** Giới hạn gõ ở ô nhập; server là nơi chặn thật (CHAT_MESSAGE_MAX = 500). */
const MESSAGE_MAX = 500;

const ICONS: Record<AssistantIcon, LucideIcon> = {
  grading: FileText,
  assignment: ClipboardList,
  forum: MessageSquare,
  course: BookOpen,
  slides: Presentation,
  pptx: Presentation,
  poll: BarChart3,
  wordcloud: Cloud,
  board: StickyNote,
  drawit: Brush,
  whiteboard: PenTool,
  timer: Clock,
  picker: Shuffle,
  grouping: Users,
  gameshow: Gamepad2,
  bank: Library,
  exam: FlaskConical,
  organize: CalendarCheck,
  oral: Bot,
  tournament: Trophy,
  insight: Brain,
  learners: UserX,
};

type Msg =
  | { role: "user"; text: string }
  // `fresh`: câu trả lời vừa về, đang hiện dần như đang gõ; liên kết và gợi ý chỉ hiện khi gõ xong.
  | { role: "assistant"; text: string; actions: AssistantAction[]; followUps: string[]; fresh?: boolean };

const HISTORY_SENT = 6;

function errorText(code: string): string {
  switch (code) {
    case "openai_not_configured":
      return "Trợ lý AI chưa được cấu hình. Báo quản trị viên kiểm tra ở mục tích hợp.";
    case "openai_busy":
      return "Hệ thống AI đang quá tải, thầy/cô đợi vài giây rồi hỏi lại nhé.";
    case "rate_limited":
      return "Thầy/cô đã hỏi quá nhiều trong một giờ, đợi chút rồi thử lại nhé.";
    case "no_token_budget":
    case "daily_token_cap":
      return "Thầy/cô đã dùng hết lượt hỏi AI. Hạn mức được cấp lại vào đầu tháng sau, hoặc mua thêm ở mục Token AI.";
    case "global_token_cap":
      return "Cả hệ thống đã chạm trần AI hôm nay. Đây là hạn mức chung, không phải lỗi của thầy/cô; thử lại vào ngày mai.";
    default:
      return "Chưa gửi được câu hỏi. Thầy/cô thử lại sau ít phút.";
  }
}

/**
 * Khung "Hôm nay thầy/cô muốn làm gì?" ở trang chủ giảng viên. Lúc đầu là các thẻ gợi ý nhìn thấy ngay (việc đang chờ
 * đứng đầu); gõ hoặc bấm thẻ "chưa có ý tưởng" thì chuyển sang trò chuyện với Limio. Đường dẫn trong câu trả lời đều
 * do server ánh xạ từ danh mục, trình duyệt không tự dựng.
 */
export default function TeacherAssistant({ starters, ideaPrompt, greeting, name }: { starters: AssistantStarter[]; ideaPrompt: string; greeting: string; name: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollToEnd = useCallback(() => endRef.current?.scrollIntoView({ block: "nearest" }), []);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (messages.length > 0) endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages, busy]);

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    setError(null);
    setInput("");
    const history = messages.slice(-HISTORY_SENT).map((m) => ({ role: m.role, text: m.text }));
    setMessages((prev) => [...prev.map((m) => (m.role === "assistant" && m.fresh ? { ...m, fresh: false } : m)), { role: "user", text }]);
    setBusy(true);
    try {
      const res = await fetch(apiUrl("/api/instructor/assistant"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const data = (await res.json().catch(() => null)) as
        | { result?: AssistantReply; error?: string }
        | null;
      if (!res.ok || !data?.result) {
        setError(errorText(data?.error ?? "unknown"));
        return;
      }
      const r = data.result;
      setMessages((prev) => [...prev, { role: "assistant", text: r.reply, actions: r.actions, followUps: r.followUps, fresh: true }]);
    } catch {
      setError(errorText("unknown"));
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  const chatting = messages.length > 0;

  const errorLine = error ? (
    <p role="alert" className="banner-danger mt-3 text-sm font-medium">{error}</p>
  ) : null;

  const inputBox = (
    <div
      className={
        chatting
          ? // Đang chat: thanh nhập phẳng, dính ở đáy khung chat (không nổi bóng như lúc mới vào).
            "flex items-center gap-2 rounded-xl border border-token bg-[rgb(var(--surface))] p-1.5 pl-3 transition-shadow focus-within:border-brand-500 focus-within:shadow-[0_0_0_3px_rgb(var(--brand)/0.15)] sm:gap-2.5"
          : "flex items-center gap-2 rounded-2xl border border-slate-300 bg-[rgb(var(--surface))] p-2 pl-3 shadow-[0_10px_28px_-10px_rgb(var(--brand)/0.5)] transition-shadow focus-within:border-brand-500 focus-within:shadow-[0_0_0_4px_rgb(var(--brand)/0.18),0_10px_28px_-10px_rgb(var(--brand)/0.5)] sm:gap-3 sm:p-2.5 sm:pl-4"
      }
    >
      <Sparkles size={20} className="hidden shrink-0 text-brand-600 min-[400px]:block" aria-hidden />
      {/* Ô một dòng (không phải textarea): chữ hoặc gợi ý dài hơn ô thì hiện "…" thay vì bị cắt giữa chừng, nhất là trên điện thoại. */}
      <input
        ref={inputRef}
        type="text"
        value={input}
        maxLength={MESSAGE_MAX}
        disabled={busy}
        enterKeyHint="send"
        autoComplete="off"
        aria-label="Nói với Limio thầy/cô muốn làm gì"
        placeholder="Hỏi Limio, ví dụ: tạo đề thi"
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          // isComposing: Enter chốt chữ khi gõ tiếng Việt bằng bộ gõ không được tính là gửi.
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void send(input);
          }
        }}
        className={`h-11 min-w-0 flex-1 text-ellipsis bg-transparent text-[15px] outline-none placeholder:text-slate-500 sm:text-base ${chatting ? "" : "sm:h-12 sm:font-medium sm:placeholder:font-normal"}`}
      />
      <button
        type="button"
        className={`flex shrink-0 items-center justify-center rounded-xl bg-pink-600 text-white transition hover:bg-pink-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${chatting ? "h-10 w-10" : "h-11 w-11 shadow-md disabled:shadow-none sm:h-12 sm:w-12"}`}
        disabled={busy || !input.trim()}
        onClick={() => void send(input)}
        aria-label="Gửi"
      >
        <SendHorizontal size={20} aria-hidden />
      </button>
    </div>
  );

  return (
    <section
      aria-labelledby="teacher-assistant-heading"
      className={`rounded-3xl border border-token bg-[rgb(var(--surface))] shadow-md ${chatting ? "overflow-hidden" : "p-5 sm:p-7"}`}
    >
      <div className={chatting ? "flex items-center gap-3 border-b border-token px-4 py-3 sm:px-5" : "flex items-start gap-3.5"}>
        <span className={`flex shrink-0 items-center justify-center bg-[rgb(var(--brand-soft))] ${chatting ? "h-9 w-9 rounded-xl" : "h-12 w-12 rounded-2xl"}`} aria-hidden>
          <LimeSliceIcon className={chatting ? "h-6 w-6" : "h-8 w-8"} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 id="teacher-assistant-heading" className={chatting ? "text-base font-bold leading-tight" : "text-h3"}>
            {greeting}, <span className="text-gradient">{name}</span>
          </h1>
          {!chatting && (
            <p className="mt-0.5 text-sm text-muted">
              <span className="font-semibold text-[rgb(var(--text))]">Hôm nay thầy/cô muốn làm gì?</span> Chưa có ý tưởng cũng không sao, cứ hỏi Limio hoặc chọn một gợi ý bên dưới.
            </p>
          )}
        </div>
        {chatting && (
          <button
            type="button"
            className="btn-ghost btn-sm shrink-0"
            onClick={() => {
              setMessages([]);
              setError(null);
            }}
          >
            Xem lại gợi ý
          </button>
        )}
      </div>

      {!chatting ? (
        <>
          <div className="mt-5">{inputBox}</div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void send(ideaPrompt)}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-[rgb(var(--text))] hover:underline disabled:opacity-60"
          >
            <Sparkles size={15} className="text-pink-600" aria-hidden />
            Chưa có ý tưởng? Để Limio gợi ý cho thầy/cô
          </button>
          {errorLine}
          <p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted">Hoặc bắt đầu nhanh</p>
          {/* grid-cols-1 = minmax(0,1fr): cột được phép co lại, nếu không chữ không xuống dòng (truncate) sẽ làm cột phình ra và tràn khỏi khung trên màn hẹp. */}
          <ul className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {starters.map((s, i) => (
              <li key={s.id} className="min-w-0">
                <StarterTile starter={s} tone={TONES[i % TONES.length]!} />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          {/* Đang trò chuyện: hội thoại ở trên, ô nhập ở cuối như mọi khung chat. */}
          <div className="max-h-[28rem] space-y-4 overflow-y-auto bg-[rgb(var(--surface-muted))] px-4 py-4 sm:px-5" aria-live="polite">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex items-start justify-end gap-3">
                  <p className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-tr-md bg-brand-600 px-3.5 py-2 text-sm text-white shadow-sm">{m.text}</p>
                  {/* Luôn là chữ "You" (không dùng ảnh), cùng tông xanh với bong bóng tin nhắn của mình. */}
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-normal text-white shadow-sm" aria-label="Bạn" role="img">
                    You
                  </span>
                </div>
              ) : (
                <div key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-token bg-[rgb(var(--surface))] shadow-sm" aria-hidden>
                    <LimeSliceIcon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <TypedBubble
                      text={m.text}
                      animate={!!m.fresh}
                      onTick={scrollToEnd}
                      onDone={() => setMessages((prev) => prev.map((x, j) => (j === i && x.role === "assistant" ? { ...x, fresh: false } : x)))}
                    />
                    {!m.fresh && m.actions.length > 0 && (
                      // Liên kết chữ gọn, không nút: việc đầu tiên là việc Limio khuyên làm trước.
                      <ul className="mt-2.5 space-y-1.5 px-1">
                        {m.actions.map((a) => (
                          <li key={a.id}>
                            <Link href={a.href} prefetch={false} className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-700 underline decoration-sky-300 underline-offset-4 transition-colors hover:text-sky-900 hover:decoration-sky-700 dark:text-sky-400">
                              {a.label}
                              <span aria-hidden>→</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                    {!m.fresh && i === messages.length - 1 && m.followUps.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {m.followUps.map((f) => (
                          <button
                            key={f}
                            type="button"
                            disabled={busy}
                            onClick={() => void send(f)}
                            className="rounded-full border border-token bg-[rgb(var(--surface))] px-3.5 py-1.5 text-left text-sm shadow-sm transition hover:border-slate-300 hover:shadow disabled:opacity-60"
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ),
            )}
            {busy && <ThinkingRow />}
            <div ref={endRef} />
          </div>
          <div className="border-t border-token p-3 sm:px-4">
            {error && <p role="alert" className="banner-danger mb-2 text-sm font-medium">{error}</p>}
            {inputBox}
          </div>
        </>
      )}
    </section>
  );
}

interface Tone {
  /** Ô biểu tượng: nền nhạt + biểu tượng đậm. */
  chip: string;
  /** Vệt màu dọc mép trái thẻ. */
  bar: string;
}

/** Màu mỗi thẻ (cùng kiểu danh sách việc gấp), xoay vòng theo vị trí; việc đang chờ luôn là vàng cam. */
const TONES: readonly Tone[] = [
  { chip: "bg-[rgb(var(--brand-soft))] text-brand-600", bar: "bg-brand-500" },
  { chip: "bg-pink-50 text-pink-600", bar: "bg-pink-500" },
  { chip: "bg-sky-50 text-sky-600", bar: "bg-sky-500" },
  { chip: "bg-violet-50 text-violet-600", bar: "bg-violet-500" },
  { chip: "bg-teal-50 text-teal-600", bar: "bg-teal-500" },
  { chip: "bg-[rgb(var(--brand-soft))] text-brand-700", bar: "bg-brand-600" },
];
function StarterTile({ starter, tone }: { starter: AssistantStarter; tone: Tone }) {
  const Icon = ICONS[starter.icon];
  return (
    <Link
      href={starter.href}
      prefetch={false}
      className="card-hover relative flex h-full w-full items-center gap-3 overflow-hidden rounded-xl border border-token bg-[rgb(var(--surface))] py-2.5 pl-4 pr-3 text-left transition-colors hover:bg-[rgb(var(--surface-muted))]"
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} aria-hidden />
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone.chip}`} aria-hidden>
        <Icon size={18} strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold leading-snug sm:truncate">{starter.title}</span>
        <span className="block text-xs text-muted sm:truncate">{starter.subtitle}</span>
      </span>
      <span className="shrink-0 text-sm text-faint" aria-hidden>→</span>
    </Link>
  );
}

/** Chữ hiện dần theo từ như đang gõ (tối đa ~1,8 giây); người chọn giảm chuyển động thì hiện luôn. Gõ xong thì gọi onDone. */
function TypedBubble({ text, animate, onTick, onDone }: { text: string; animate: boolean; onTick: () => void; onDone: () => void }) {
  const words = text.split(/(\s+)/); // giữ cả khoảng trắng để pre-wrap không đổi
  const total = words.length;
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [shown, setShown] = useState(animate && !reduce ? 0 : total);
  const done = useRef(false);

  useEffect(() => {
    if (!animate || reduce) {
      if (animate && !done.current) {
        done.current = true;
        onDone();
      }
      return;
    }
    const stepMs = 40;
    const perTick = Math.max(1, Math.ceil(total / (1800 / stepMs)));
    const id = window.setInterval(() => {
      setShown((n) => {
        const next = Math.min(total, n + perTick);
        if (next >= total) window.clearInterval(id);
        return next;
      });
    }, stepMs);
    return () => window.clearInterval(id);
    // Chỉ chạy một lần cho mỗi câu trả lời mới.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!animate) return;
    onTick();
    if (shown >= total && !done.current) {
      done.current = true;
      onDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  return (
    <p className="whitespace-pre-wrap rounded-2xl rounded-tl-md border border-token bg-[rgb(var(--surface))] px-3.5 py-2.5 text-sm leading-relaxed shadow-sm">
      {animate && !reduce ? words.slice(0, shown).join("") : text}
      {animate && !reduce && shown < total && <span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse bg-slate-400" aria-hidden />}
    </p>
  );
}

/** Limio đang nghĩ: bong bóng ba chấm nhấp nháy kèm dòng chữ, để người dùng biết hệ thống vẫn đang làm việc. */
function ThinkingRow() {
  return (
    <div className="flex items-start gap-3" role="status" aria-live="polite">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-token bg-[rgb(var(--surface))] shadow-sm" aria-hidden>
        <LimeSliceIcon className="h-5 w-5" />
      </span>
      <div className="flex items-center gap-2.5 rounded-2xl rounded-tl-md border border-token bg-[rgb(var(--surface))] px-3.5 py-2.5 shadow-sm">
        <span className="flex items-center gap-1" aria-hidden>
          {[0, 150, 300].map((d) => (
            <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-pink-500" style={{ animationDelay: `${d}ms` }} />
          ))}
        </span>
        <span className="text-sm text-muted">Limio đang soạn câu trả lời…</span>
      </div>
    </div>
  );
}
