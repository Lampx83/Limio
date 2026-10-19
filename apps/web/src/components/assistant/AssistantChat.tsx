"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { SendHorizontal, Sparkles } from "lucide-react";
import { WatermelonSliceIcon } from "../BrandIcons";
import { ASSISTANT_ICONS } from "./icons";
import { useAssistant } from "./AssistantProvider";
import type { AssistantIcon } from "@/lib/teacherAssistant";
import { suggestionsFor } from "@/lib/assistantSuggestions";

/** Giới hạn gõ ở ô nhập; máy chủ là nơi chặn thật (CHAT_MESSAGE_MAX = 500). */
const MESSAGE_MAX = 500;

/** Avatar của Lily (lát dưa hấu, màu hồng) cạnh mỗi lời của trợ lý; khác trợ giảng AI ở trang bài học của học viên. */
export function LilyAvatar({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span
      className={`mt-0.5 flex shrink-0 items-center justify-center rounded-full border border-pink-200 bg-pink-50 shadow-sm ${size === "lg" ? "h-10 w-10" : "h-8 w-8"}`}
      aria-hidden
    >
      <WatermelonSliceIcon className={size === "lg" ? "h-6 w-6" : "h-5 w-5"} />
    </span>
  );
}

/**
 * Lời chào đầu tiên của Lily kèm vài câu hỏi đề xuất theo trang đang đứng (bấm là hỏi ngay). `onPick`: việc làm khi bấm
 * một câu (gửi câu đó).
 */
export function LilyIntro({ onPick }: { onPick: (question: string) => void }) {
  const pathname = usePathname();
  const { busy, recentCourseTitle } = useAssistant();
  return (
    <div className="flex items-start gap-3">
      <LilyAvatar />
      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-wrap rounded-2xl rounded-tl-md border border-token bg-[rgb(var(--surface))] px-3.5 py-2.5 text-sm leading-relaxed shadow-sm">
          Xin chào thầy/cô, em là Lily, trợ lý ảo của thầy/cô trên Limio. Nhiệm vụ chính của em là hướng dẫn sử dụng các tính năng trên Limio (soạn khoá học, bài giảng, kiểm tra, chấm bài, quản lý lớp...) và gợi ý việc nên làm. Thầy/cô cần gì ạ?
        </p>
        <p className="mt-3 text-xs font-semibold text-muted">Thầy/cô có thể hỏi em, ví dụ:</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {suggestionsFor(pathname, recentCourseTitle).map((q) => (
            <button
              key={q}
              type="button"
              disabled={busy}
              onClick={() => onPick(q)}
              className="rounded-full border border-token bg-[rgb(var(--surface))] px-3.5 py-1.5 text-left text-sm shadow-sm transition hover:border-slate-300 hover:shadow disabled:opacity-60"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Danh sách tin trong cuộc trò chuyện (trong ngăn kéo). Tự cuộn xuống tin mới nhất.
 * `intro`: một lời của Lily hiện ở đầu khi chưa có tin nào (ngăn kéo vừa mở).
 */
export function AssistantThread({ className = "", intro }: { className?: string; intro?: React.ReactNode }) {
  const { messages, busy, send, markDone } = useAssistant();
  const endRef = useRef<HTMLDivElement>(null);
  const scrollToEnd = useCallback(() => endRef.current?.scrollIntoView({ block: "nearest" }), []);

  useEffect(() => {
    if (messages.length > 0 || busy) endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages, busy]);

  return (
    <div className={`space-y-4 overflow-y-auto ${className}`} aria-live="polite">
      {messages.length === 0 && intro}
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
            <LilyAvatar />
            <div className="min-w-0 flex-1">
              <TypedBubble text={m.text} animate={!!m.fresh} onTick={scrollToEnd} onDone={() => markDone(i)} />
              {!m.fresh && m.actions.length > 0 && (
                // Liên kết chữ gọn, không nút: việc đầu tiên là việc Lily khuyên làm trước. Bấm vào thì trang mở trong cùng tab;
                // cuộc trò chuyện vẫn còn ở nút nổi .
                <ul className="mt-2.5 space-y-1.5 px-1">
                  {m.actions.map((a) => {
                    const Icon = ASSISTANT_ICONS[a.icon as AssistantIcon] ?? Sparkles;
                    return (
                      <li key={a.id}>
                        <Link href={a.href} prefetch={false} className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-700 underline decoration-sky-300 underline-offset-4 transition-colors hover:text-sky-900 hover:decoration-sky-700 dark:text-sky-400">
                          <Icon size={15} aria-hidden className="shrink-0" />
                          {a.label}
                          <span aria-hidden>→</span>
                        </Link>
                      </li>
                    );
                  })}
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
  );
}

/**
 * Ô nhập một dòng (không phải textarea): chữ hoặc gợi ý dài hơn ô thì hiện "…" thay vì bị cắt giữa chừng, nhất là
 * trên điện thoại. `variant="docked"`: phẳng, dính đáy khung chat; `"hero"`: dạng nổi bật, hiện chưa trang nào dùng.
 */
export function AssistantInput({
  variant,
  autoFocus = false,
  refocusAfterReply = true,
  onSent,
}: {
  variant: "hero" | "docked";
  autoFocus?: boolean;
  /** Trả con trỏ về ô sau khi Lily trả lời xong. Tắt ở khung trang chủ: lúc đó cuộc trò chuyện đã chuyển xuống ngăn kéo. */
  refocusAfterReply?: boolean;
  /** Gọi ngay sau khi gửi (vd mở ngăn kéo để thấy cuộc trò chuyện). */
  onSent?: () => void;
}) {
  const { busy, send } = useAssistant();
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const wasBusy = useRef(false);
  const docked = variant === "docked";

  // Trả con trỏ về ô sau khi Lily trả lời xong.
  useEffect(() => {
    if (refocusAfterReply && wasBusy.current && !busy) inputRef.current?.focus();
    wasBusy.current = busy;
  }, [busy, refocusAfterReply]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const submit = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    void send(text);
    onSent?.();
  };

  return (
    <div
      className={
        docked
          ? "flex items-center gap-2 rounded-xl border border-token bg-[rgb(var(--surface))] p-1.5 pl-3 transition-shadow focus-within:border-brand-500 focus-within:shadow-[0_0_0_3px_rgb(var(--brand)/0.15)] sm:gap-2.5"
          : "flex items-center gap-2 rounded-2xl border border-slate-300 bg-[rgb(var(--surface))] p-2 pl-3 shadow-[0_10px_28px_-10px_rgb(var(--brand)/0.5)] transition-shadow focus-within:border-brand-500 focus-within:shadow-[0_0_0_4px_rgb(var(--brand)/0.18),0_10px_28px_-10px_rgb(var(--brand)/0.5)] sm:gap-3 sm:p-2.5 sm:pl-4"
      }
    >
      <Sparkles size={20} className="hidden shrink-0 text-pink-600 min-[400px]:block" aria-hidden />
      <input
        ref={inputRef}
        type="text"
        value={input}
        maxLength={MESSAGE_MAX}
        disabled={busy}
        enterKeyHint="send"
        autoComplete="off"
        aria-label="Nói với Lily, trợ lý ảo của thầy/cô"
        placeholder="Hỏi Lily, ví dụ: tạo đề thi"
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          // isComposing: Enter chốt chữ khi gõ tiếng Việt bằng bộ gõ không được tính là gửi.
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        className={`h-11 min-w-0 flex-1 text-ellipsis bg-transparent text-[15px] outline-none placeholder:text-slate-500 sm:text-base ${docked ? "" : "sm:h-12 sm:font-medium sm:placeholder:font-normal"}`}
      />
      <button
        type="button"
        className={`flex shrink-0 items-center justify-center rounded-xl bg-pink-600 text-white transition hover:bg-pink-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${docked ? "h-10 w-10" : "h-11 w-11 shadow-md disabled:shadow-none sm:h-12 sm:w-12"}`}
        disabled={busy || !input.trim()}
        onClick={submit}
        aria-label="Gửi"
      >
        <SendHorizontal size={20} aria-hidden />
      </button>
    </div>
  );
}

/** Chữ hiện dần theo từ như đang gõ (tối đa ~1,8 giây); người chọn giảm chuyển động thì hiện luôn. Gõ xong thì gọi onDone. */
export function TypedBubble({ text, animate, onTick, onDone }: { text: string; animate: boolean; onTick: () => void; onDone: () => void }) {
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

/** Lily đang nghĩ: bong bóng ba chấm nhấp nháy kèm dòng chữ, để người dùng biết hệ thống vẫn đang làm việc. */
export function ThinkingRow() {
  return (
    <div className="flex items-start gap-3" role="status" aria-live="polite">
      <LilyAvatar />
      <div className="flex items-center gap-2.5 rounded-2xl rounded-tl-md border border-token bg-[rgb(var(--surface))] px-3.5 py-2.5 shadow-sm">
        <span className="flex items-center gap-1" aria-hidden>
          {[0, 150, 300].map((d) => (
            <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-pink-500" style={{ animationDelay: `${d}ms` }} />
          ))}
        </span>
        <span className="text-sm text-muted">Em đang soạn câu trả lời…</span>
      </div>
    </div>
  );
}
