"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Info, Sparkles } from "lucide-react";
import { WatermelonSliceIcon } from "./BrandIcons";
import { AssistantInput, AssistantThread } from "./assistant/AssistantChat";
import { useAssistant } from "./assistant/AssistantProvider";
import { ASSISTANT_ICONS } from "./assistant/icons";
// Chỉ import kiểu: teacherAssistant.ts kéo theo cả chuỗi limioLiveChat (phía server), không để vào bundle trình duyệt.
import type { AssistantStarter } from "@/lib/teacherAssistant";

/**
 * Khung của Limio, trợ lý ảo của thầy/cô, ở trang chủ giảng viên. Lúc đầu là lời chào của Limio kèm ô hỏi và các thẻ
 * gợi ý; gõ hoặc bấm "Chưa có ý tưởng?" thì chuyển sang trò chuyện. Cuộc trò chuyện dùng chung với nút nổi ở các trang
 * khác (AssistantProvider), nên bấm liên kết Limio đưa rồi quay lại vẫn thấy tiếp. Đường dẫn trong câu trả lời đều do
 * máy chủ ánh xạ từ danh mục, trình duyệt không tự dựng.
 */
export default function TeacherAssistant({ starters, ideaPrompt, greeting, name }: { starters: AssistantStarter[]; ideaPrompt: string; greeting: string; name: string }) {
  const { messages, busy, error, send, reset, registerSurface } = useAssistant();
  // Khung này đang hiện trên trang: câu trả lời về lúc này thầy/cô thấy ngay, không cần chấm "chưa đọc" ở nút nổi.
  useEffect(() => registerSurface(), [registerSurface]);
  const chatting = messages.length > 0;

  const errorLine = error ? <p role="alert" className="banner-danger mt-3 text-sm font-medium">{error}</p> : null;

  return (
    <section
      aria-labelledby="teacher-assistant-heading"
      className={`rounded-3xl border border-token bg-[rgb(var(--surface))] shadow-md ${chatting ? "overflow-hidden" : "p-5 sm:p-7"}`}
    >
      <div className={chatting ? "flex items-center gap-3 border-b border-token px-4 py-3 sm:px-5" : "flex items-start gap-3.5"}>
        <span className={`flex shrink-0 items-center justify-center bg-pink-50 ${chatting ? "h-9 w-9 rounded-xl" : "h-12 w-12 rounded-2xl"}`} aria-hidden>
          <WatermelonSliceIcon className={chatting ? "h-6 w-6" : "h-8 w-8"} />
        </span>
        <div className="min-w-0 flex-1">
          {chatting ? (
            <>
              <h1 id="teacher-assistant-heading" className="text-base font-bold leading-tight">Limio</h1>
              <p className="truncate text-xs text-muted">Trợ lý ảo của thầy/cô · chỉ hỗ trợ cách dùng Limio</p>
            </>
          ) : (
            <>
              {/* Lời chào là lời của Limio nói với giảng viên: nêu rõ ai đang nói. */}
              <p className="text-xs font-semibold text-muted">
                <span className="font-bold text-pink-600">Limio</span> · Trợ lý ảo của thầy/cô trên Limio
              </p>
              <h1 id="teacher-assistant-heading" className="text-h3">
                {greeting}, <span className="text-gradient">{name}</span>!
              </h1>
              <p className="mt-0.5 text-sm text-muted">
                Limio rất vui được giúp thầy/cô hôm nay. <span className="font-semibold text-[rgb(var(--text))]">Thầy/cô muốn làm gì?</span> Chưa có ý tưởng cũng không sao, cứ hỏi Limio hoặc chọn một gợi ý bên dưới.
              </p>
            </>
          )}
        </div>
        {chatting && (
          <button type="button" className="btn-ghost btn-sm shrink-0" onClick={reset}>
            Cuộc trò chuyện mới
          </button>
        )}
      </div>

      {!chatting ? (
        <>
          <div className="mt-5">
            <AssistantInput variant="hero" />
          </div>
          {/* Nói rõ phạm vi ngay trước khi gõ: Limio chỉ hỗ trợ cách dùng và các tính năng của Limio. */}
          <p className="mt-2.5 flex items-start gap-1.5 text-xs leading-relaxed text-muted">
            <Info size={14} className="mt-0.5 shrink-0 text-pink-600" aria-hidden />
            <span>
              Nhiệm vụ chính của tôi là hướng dẫn sử dụng các tính năng trên Limio (soạn khoá học, bài giảng, kiểm tra, chấm bài, quản lý lớp...).
            </span>
          </p>
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
          {/* grid-cols-1 = minmax(0,1fr): cột được phép co lại, nếu không chữ không xuống dòng sẽ làm cột phình ra và tràn khỏi khung trên màn hẹp. */}
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
          <AssistantThread className="max-h-[28rem] bg-[rgb(var(--surface-muted))] px-4 py-4 sm:px-5" />
          <div className="border-t border-token p-3 sm:px-4">
            {error && <p role="alert" className="banner-danger mb-2 text-sm font-medium">{error}</p>}
            <AssistantInput variant="docked" />
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

/** Màu mỗi thẻ (cùng kiểu danh sách việc gấp), xoay vòng theo vị trí. */
const TONES: readonly Tone[] = [
  { chip: "bg-[rgb(var(--brand-soft))] text-brand-600", bar: "bg-brand-500" },
  { chip: "bg-pink-50 text-pink-600", bar: "bg-pink-500" },
  { chip: "bg-sky-50 text-sky-600", bar: "bg-sky-500" },
  { chip: "bg-violet-50 text-violet-600", bar: "bg-violet-500" },
  { chip: "bg-teal-50 text-teal-600", bar: "bg-teal-500" },
  { chip: "bg-[rgb(var(--brand-soft))] text-brand-700", bar: "bg-brand-600" },
];

function StarterTile({ starter, tone }: { starter: AssistantStarter; tone: Tone }) {
  const Icon = ASSISTANT_ICONS[starter.icon];
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
