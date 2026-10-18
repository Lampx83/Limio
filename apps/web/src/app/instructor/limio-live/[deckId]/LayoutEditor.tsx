"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ArrowRight, BarChart3, Bold, Check, ChevronLeft, ChevronRight, Italic, Loader2, Pencil, Plus, Sparkles, Undo2, X } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import {
  ITEM_RANGE,
  LAYOUT_META,
  MAX_LEN,
  SLIDE_ICONS,
  SLIDE_LAYOUTS,
  convertLayoutConfig,
  layoutTextProblems,
  padForEditing,
  pickMeta,
  toggleInlineMarker,
  resolveLayout,
  sanitizeLayoutConfig,
  slideConfigsEqual,
  splitSlideConfig,
  type LayoutColumn,
  type LayoutItem,
  type SlideLayoutId,
} from "@/lib/limioLiveSlides";
import { LAYOUT_ICONS, LayoutSlideView } from "../SlideLayouts";
import { ChartSheet, TableSheet } from "./DataSheetEditor";
import ChartFromImagePanel from "./ChartFromImagePanel";
import { canRedraw, restoreImage } from "@/lib/limioLiveChartFromImage";
import { motifSlot } from "@/lib/limioLiveMotifs";
import { useSlideMotif } from "../liveMotifContext";
import { SlideMotifField } from "./MotifPicker";
import { CoverStylePicker } from "./CoverStylePicker";
import OutlineGlyph from "./outline/OutlineGlyph";
import PickerButton from "./outline/PickerButton";

type Cfg = Record<string, any>;
type Save = (patch: { config: Cfg }) => void;

const ICON_LABELS: Record<(typeof SLIDE_ICONS)[number], string> = {
  target: "Mục tiêu",
  compass: "La bàn",
  route: "Lộ trình",
  chat: "Trao đổi",
  book: "Sách",
  sparkle: "Ý tưởng",
  users: "Nhóm",
  chart: "Biểu đồ",
};

/** Giữ ghi chú giảng và các khoá không thuộc bố cục khi lưu. */
const keepExtras = (config: Cfg): Cfg => pickMeta(config);
/**
 * Khoá meta khi lưu, riêng dòng nguồn ở chân slide (bài soạn kèm trang tìm trên internet) lấy theo bản đang sửa:
 * giảng viên tự viết lại nội dung thì sửa hoặc xoá được dòng nguồn, không để nguồn cũ gắn vào chữ mới.
 */
const extrasFor = (config: Cfg, draft: Cfg): Cfg => {
  const m = keepExtras(config);
  if (!("cite" in m)) return m;
  delete m.cite;
  const c = typeof draft.cite === "string" ? draft.cite.trim().slice(0, MAX_LEN.source) : "";
  return c ? { ...m, cite: c } : m;
};

const glyphOf = (l: SlideLayoutId) => (l === "classic" ? "content" : l);

/** Chọn bố cục: khung gọn chỉ hiện bố cục hiện tại; bấm mới mở lưới hình để đổi (xem convertLayoutConfig: đổi bố cục mang theo nội dung). */
export function LayoutPicker({
  config,
  onSave,
  draft,
}: {
  config: Cfg;
  onSave: Save;
  /** Nội dung đang gõ dở (chưa lưu) để mang sang bố cục mới; mặc định lấy từ config đã lưu. */
  draft?: Cfg;
}) {
  const current = resolveLayout(config);
  const [open, setOpen] = useState(false);
  const change = (to: SlideLayoutId) => {
    setOpen(false);
    if (to === current) return;
    onSave({ config: { ...convertLayoutConfig(draft ?? config, to), ...keepExtras(config) } });
  };
  return (
    <div className="space-y-2">
      <PickerButton cap="Bố cục" glyph={glyphOf(current)} label={LAYOUT_META[current].label} open={open} onClick={() => setOpen((v) => !v)} />
      {open && (
        <div className="space-y-2">
          <p className="text-[13px] text-muted">
            {LAYOUT_META[current].hint}. Đổi bố cục giữ nguyên chữ đang có.
          </p>
          <div role="group" aria-label="Bố cục slide" className="grid gap-1.5 [grid-template-columns:repeat(auto-fill,minmax(88px,1fr))]">
            {SLIDE_LAYOUTS.map((l) => (
              <button
                key={l}
                type="button"
                title={LAYOUT_META[l].hint}
                aria-pressed={l === current}
                onClick={() => change(l)}
                className={`grid justify-items-center gap-0.5 rounded-[10px] border px-1 pb-1 pt-1.5 text-[12.5px] leading-tight transition-colors ${
                  l === current
                    ? "border-brand-600 bg-brand-soft font-bold text-[rgb(var(--text))] ring-1 ring-brand-600"
                    : "border-token bg-[rgb(var(--surface))] text-muted hover:bg-[rgb(var(--surface-muted))]"
                }`}
              >
                <OutlineGlyph k={glyphOf(l)} className="h-[30px] w-full" />
                <span>{LAYOUT_META[l].label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── In đậm / in nghiêng: một thanh dùng chung cho mọi ô, tác động lên ô đang soạn ────────

interface FieldCtl {
  el: HTMLInputElement | HTMLTextAreaElement;
  latest: { current: { value: string; max: number; onChange: (v: string) => void } };
}
/** `ready`: cửa sổ sửa đã mở, đo được chiều cao ô nhập (lúc đóng chiều cao đo ra 0). */
const FormatCtx = createContext<{ focus: (c: FieldCtl | null) => void; ready: boolean } | null>(null);

function Field({
  label,
  value,
  onChange,
  onBlur,
  max,
  multiline,
  placeholder,
  plain,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  max: number;
  multiline?: boolean;
  placeholder?: string;
  /** true = ô không hỗ trợ in đậm/nghiêng (số liệu, địa chỉ ảnh...). */
  plain?: boolean;
}) {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const ctx = useContext(FormatCtx);
  const latest = useRef({ value, max, onChange });
  latest.current = { value, max, onChange };
  const near = value.length > max * 0.85;
  const onFocus = () => {
    if (ref.current) ctx?.focus(plain ? null : { el: ref.current, latest });
  };
  // Ô nhiều dòng tự giãn theo chữ, không cuộn trong ô.
  useEffect(() => {
    const el = ref.current;
    if (!multiline || !el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value, multiline, ctx?.ready]);
  return (
    <label className="block">
      <span className="mb-0.5 flex items-center justify-between text-xs font-semibold text-muted">
        {label}
        {near && (
          <span className={value.length >= max ? "text-red-600" : "text-amber-700"}>
            {value.length}/{max}
          </span>
        )}
      </span>
      {multiline ? (
        <textarea
          ref={ref as React.Ref<HTMLTextAreaElement>}
          value={value}
          maxLength={max}
          rows={1}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          className="input w-full overflow-hidden text-sm"
        />
      ) : (
        <input
          ref={ref as React.Ref<HTMLInputElement>}
          value={value}
          maxLength={max}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          className="input w-full text-sm"
        />
      )}
    </label>
  );
}

type EditAction = "shorter" | "example" | "simpler" | "to_quiz" | "rewrite" | "custom";
interface Proposal {
  type: "content" | "quiz";
  config: Cfg;
}


const AI_ERROR: Record<string, string> = {
  openai_not_configured: "Hệ thống AI chưa được cấu hình. Vui lòng báo quản trị viên.",
  global_token_cap: "Hệ thống AI đang quá tải hôm nay. Bạn vẫn có thể sửa tay.",
  daily_token_cap: "Bạn đã dùng hết hạn mức AI hôm nay. Bạn vẫn có thể sửa tay.",
  monthly_token_cap: "Bạn đã dùng hết hạn mức AI của tháng này. Bạn vẫn có thể sửa tay.",
  ai_edit_failed: "AI chưa viết lại được slide này. Hãy thử lại hoặc sửa tay.",
  ai_chat_failed: "AI chưa trả lời được lúc này. Hãy thử lại.",
  unsupported_slide: "Slide này chưa dùng được Nhờ AI.",
  no_outline_row: "Slide này không còn dòng dàn ý gốc để viết lại.",
  validation_failed: "Yêu cầu cần từ 3 đến 500 ký tự.",
};

/** AI trả về chưa đủ nội dung cho bố cục đích: nói rõ bố cục nào để giảng viên biết nên thử lại hay nói rõ yêu cầu hơn. */
function incompleteText(layout: string | undefined): string {
  const name = layout === "quiz" ? "câu hỏi quiz" : layout && layout in LAYOUT_META ? LAYOUT_META[layout as keyof typeof LAYOUT_META].label : "";
  return `AI trả về chưa đủ nội dung${name ? ` cho bố cục ${name}` : ""}. Hãy thử lại, hoặc nói rõ hơn trong yêu cầu; bạn vẫn có thể sửa tay.`;
}

const QUICK_ACTIONS: Array<{ id: Exclude<EditAction, "custom">; label: string; hint: string }> = [
  { id: "shorter", label: "Viết ngắn hơn", hint: "Rút gọn câu chữ, giữ ý chính" },
  { id: "example", label: "Thêm ví dụ", hint: "Bổ sung một ví dụ cụ thể" },
  { id: "simpler", label: "Dễ hiểu hơn", hint: "Dùng từ giản dị hơn" },
  { id: "to_quiz", label: "Đổi thành quiz", hint: "Biến nội dung thành một câu hỏi trắc nghiệm" },
  { id: "rewrite", label: "Viết lại từ dàn ý", hint: "Quay về ý trong dàn ý đã xác nhận" },
];
// Khớp CHAT_MESSAGE_MAX / CHAT_HISTORY_TURNS của lib/limioLiveChat (máy chủ kiểm lại).
const CHAT_MAX = 500;
const CHAT_HISTORY = 6;

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  text: string;
  kind?: "answer" | "clarify" | "propose";
  options?: string[];
  suggestion?: string;
  /** Đề xuất của lượt này: đang chờ quyết định, đã áp dụng hay đã bỏ. */
  proposal?: "pending" | "applied" | "discarded";
  /** Đã bấm một hướng gợi ý hoặc "Làm theo gợi ý này". */
  used?: boolean;
}

let chatSeq = 0;
const newChatId = () => `m${++chatSeq}`;

/**
 * Hỏi đáp với AI về một slide. Cuộc trò chuyện chỉ sống trong trình sửa: chuyển slide hay đóng là mất (bản đầu không lưu).
 * Câu hỏi tự do đi qua ai-chat (AI tự chọn trả lời, hỏi lại hay đề xuất); lựa chọn nhanh và "Làm theo gợi ý này" đi qua
 * ai-edit (một đề xuất chắc chắn). Đề xuất đang chờ hiện trên bản xem trước lớn; không ghi gì vào slide khi chưa Áp dụng.
 */
function useSlideAiChat(deckId: string, slideId: string) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState<{ msgId: string; proposal: Proposal; action: string } | null>(null);
  const [view, setView] = useState<"before" | "after">("after");
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    setMsgs([]);
    setPending(null);
    setErr(null);
    setBusy(false);
  }, [slideId]);

  const mark = (id: string, patch: Partial<ChatMsg>) => setMsgs((ms) => ms.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const base = `/api/instructor/limio-live/decks/${deckId}/slides/${slideId}`;
  const post = async (path: string, body: unknown) => {
    const res = await fetch(apiUrl(`${base}/${path}`), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = (await res.json().catch(() => null)) as Record<string, any> | null;
    return { ok: res.ok, j };
  };
  /** Mở một lượt: lượt mới thay đề xuất còn đang chờ (giảng viên đã chuyển sang yêu cầu khác). */
  const begin = (text: string) => {
    if (pending) mark(pending.msgId, { proposal: "discarded" });
    setPending(null);
    setErr(null);
    setBusy(true);
    setMsgs((ms) => [...ms, { id: newChatId(), role: "user", text }]);
  };
  const showProposal = (proposal: Proposal, action: string, text: string) => {
    const id = newChatId();
    setMsgs((ms) => [...ms, { id, role: "assistant", kind: "propose", text, proposal: "pending" }]);
    setPending({ msgId: id, proposal, action });
    setView("after");
  };

  const ask = async (text: string) => {
    const history = msgs.slice(-CHAT_HISTORY).map((m) => ({ role: m.role, text: m.text }));
    begin(text);
    try {
      const { ok, j } = await post("ai-chat", { message: text, history });
      if (!ok || !j?.result) return setErr(AI_ERROR[j?.error ?? ""] ?? "Không hỏi AI được lúc này. Vui lòng thử lại.");
      if (typeof j.remainingTurns === "number") setRemaining(j.remainingTurns);
      const r = j.result as { kind: ChatMsg["kind"]; reply: string; options?: string[]; suggestion?: string; proposal?: Proposal };
      if (r.kind === "propose" && r.proposal) return showProposal(r.proposal, "chat", r.reply);
      setMsgs((ms) => [...ms, { id: newChatId(), role: "assistant", kind: r.kind, text: r.reply, options: r.options, suggestion: r.suggestion }]);
    } catch {
      setErr("Mất kết nối. Vui lòng kiểm tra mạng rồi thử lại.");
    } finally {
      setBusy(false);
    }
  };

  const act = async (action: EditAction, text: string, instruction?: string) => {
    begin(text);
    try {
      const { ok, j } = await post("ai-edit", action === "custom" ? { action, instruction } : { action });
      if (j?.error === "ai_edit_incomplete") return setErr(incompleteText(j.details?.layout));
      if (!ok || !j?.proposal) return setErr(AI_ERROR[j?.error ?? ""] ?? "Không nhờ AI được lúc này. Vui lòng thử lại.");
      const p = j.proposal as Proposal;
      showProposal(p, action, p.type === "quiz" ? "Đây là câu hỏi quiz đề xuất thay cho slide này." : "Đây là bản đề xuất sửa slide.");
    } catch {
      setErr("Mất kết nối. Vui lòng kiểm tra mạng rồi thử lại.");
    } finally {
      setBusy(false);
    }
  };

  /** Chốt đề xuất đang chờ; trả đề xuất đó để trình sửa ghi vào slide khi Áp dụng. */
  const settle = (status: "applied" | "discarded") => {
    if (!pending) return null;
    mark(pending.msgId, { proposal: status });
    setPending(null);
    return pending;
  };

  return { msgs, busy, err, pending, view, setView, remaining, ask, act, mark, settle };
}
type SlideAiChat = ReturnType<typeof useSlideAiChat>;

function AiChatPanel({
  chat,
  hasOutline,
  generalKnowledge,
  onDecide,
}: {
  chat: SlideAiChat;
  hasOutline: boolean;
  /** Bài soạn từ mô tả chủ đề: câu trả lời dựa trên kiến thức chung, cần nhắc kiểm tra. */
  generalKnowledge: boolean;
  onDecide: (kind: "apply" | "discard") => void;
}) {
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.msgs, chat.busy]);
  const submit = () => {
    const t = text.trim();
    if (!t || chat.busy) return;
    setText("");
    void chat.ask(t);
  };
  const quick = hasOutline ? QUICK_ACTIONS : QUICK_ACTIONS.filter((q) => q.id !== "rewrite");

  return (
    <div className="flex min-h-0 flex-1 flex-col" role="tabpanel" aria-label="Nhờ AI">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3" aria-live="polite">
        {chat.msgs.length === 0 ? (
          <div className="space-y-2 text-sm text-muted">
            <p>
              Hỏi AI về slide này, hoặc nhờ AI sửa. AI có thể trả lời, hỏi lại cho rõ, hoặc đề xuất một bản sửa; không có gì
              ghi vào slide khi thầy/cô chưa bấm Áp dụng.
            </p>
            <p>Ví dụ: &quot;Ý thứ hai có chính xác không?&quot;, &quot;Đổi tiêu đề thành Các khái niệm.&quot;</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {chat.msgs.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="max-w-[92%] self-end whitespace-pre-line rounded-2xl rounded-br-md bg-brand-soft px-3 py-2 text-sm">
                  {m.text}
                </div>
              ) : (
                <div key={m.id} className="max-w-[96%] self-start text-sm">
                  <p className="mb-0.5 flex items-center gap-1 text-xs font-bold text-muted">
                    <Sparkles size={12} aria-hidden /> AI
                  </p>
                  <p className="whitespace-pre-line">{m.text}</p>
                  {generalKnowledge && m.kind === "answer" && (
                    <p className="mt-1 text-xs text-muted">Câu trả lời dựa trên kiến thức chung, thầy/cô cần kiểm tra.</p>
                  )}
                  {m.kind === "clarify" && m.options?.length ? (
                    <div className="mt-2 grid gap-1.5">
                      {m.options.map((o) => (
                        <button
                          key={o}
                          type="button"
                          disabled={chat.busy || m.used}
                          onClick={() => {
                            chat.mark(m.id, { used: true });
                            void chat.ask(o);
                          }}
                          className="rounded-lg border border-token bg-[rgb(var(--surface))] px-3 py-1.5 text-left transition hover:border-brand-600 disabled:opacity-50"
                        >
                          {o}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {m.kind === "answer" && m.suggestion && (
                    <button
                      type="button"
                      disabled={chat.busy || m.used}
                      onClick={() => {
                        chat.mark(m.id, { used: true });
                        void chat.act("custom", "Làm theo gợi ý này.", m.suggestion);
                      }}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-brand-600 px-2.5 py-1 text-[13px] font-semibold text-brand-700 transition hover:bg-brand-soft disabled:opacity-50"
                    >
                      <Sparkles size={13} aria-hidden /> Làm theo gợi ý này
                    </button>
                  )}
                  {m.kind === "propose" &&
                    (m.proposal === "pending" ? (
                      <div className="mt-2 rounded-xl border border-brand-500 p-2.5">
                        <p className="text-[13px] font-semibold">Đề xuất đang hiện trên khung xem trước (chưa áp dụng)</p>
                        <div className="mt-2 flex gap-2">
                          <button type="button" className="btn-secondary px-3 py-1 text-[13px]" onClick={() => onDecide("discard")}>
                            Bỏ
                          </button>
                          <button type="button" className="btn-primary flex items-center gap-1 px-3 py-1 text-[13px]" onClick={() => onDecide("apply")}>
                            <Check size={13} /> Áp dụng
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-1 text-xs italic text-muted">{m.proposal === "applied" ? "Đã áp dụng vào slide." : "Đã bỏ đề xuất."}</p>
                    ))}
                </div>
              ),
            )}
          </div>
        )}
        {chat.busy && (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted" role="status">
            <Loader2 size={14} className="animate-spin" /> AI đang trả lời...
          </p>
        )}
      </div>

      <div className="shrink-0 space-y-2 border-t border-token px-3 py-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Chọn nhanh">
          {quick.map((q) => (
            <button
              key={q.id}
              type="button"
              title={q.hint}
              disabled={chat.busy}
              onClick={() => void chat.act(q.id, `${q.label}.`)}
              className="rounded-lg border border-token bg-[rgb(var(--surface))] px-2.5 py-1 text-[13px] text-muted transition hover:border-brand-600 hover:text-[rgb(var(--text))] disabled:opacity-50"
            >
              {q.label}
            </button>
          ))}
        </div>
        <div className="relative rounded-xl border-[1.5px] border-token bg-[rgb(var(--surface))] focus-within:border-brand-600">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Enter gửi, Shift + Enter xuống dòng; không gửi khi đang gõ dấu tiếng Việt (IME).
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            rows={2}
            maxLength={CHAT_MAX}
            aria-label="Hỏi hoặc nhờ AI sửa slide này"
            placeholder="Hỏi về slide này, hoặc nhờ AI sửa. Ví dụ: Ý thứ hai có chính xác không?"
            className="block w-full resize-none rounded-xl border-0 bg-transparent px-3 py-2 pr-12 text-sm focus:outline-none focus:ring-0"
          />
          <button
            type="button"
            aria-label="Gửi"
            disabled={!text.trim() || chat.busy}
            onClick={submit}
            className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white transition disabled:opacity-40"
          >
            <ArrowRight size={16} />
          </button>
        </div>
        <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs">
          <span role={chat.err ? "alert" : undefined} className={chat.err ? "font-medium text-red-700" : "text-muted"}>
            {chat.err ?? "Enter để gửi, Shift + Enter xuống dòng."}
          </span>
          {chat.remaining !== null && <span className="text-muted">Còn khoảng {chat.remaining.toLocaleString("vi-VN")} lượt AI trong tháng</span>}
        </div>
        <p className="text-xs text-faint">Cuộc trò chuyện không được lưu khi đóng cửa sổ sửa hoặc chuyển slide.</p>
      </div>
    </div>
  );
}

function QuizPreview({ config }: { config: Cfg }) {
  const opts: Array<{ text: string; correct?: boolean }> = Array.isArray(config.options) ? config.options : [];
  return (
    <div className="space-y-2 rounded-lg border border-token bg-white p-3 text-sm">
      <p className="font-semibold">{config.question}</p>
      <ul className="space-y-1">
        {opts.map((o, i) => (
          <li key={i} className={`flex items-start gap-2 rounded px-2 py-1 ${o.correct ? "bg-emerald-50 font-medium text-emerald-900" : ""}`}>
            <span className="font-bold">{String.fromCharCode(65 + i)}.</span>
            <span>{o.text}</span>
            {o.correct && <Check size={14} className="ml-auto mt-0.5 shrink-0" />}
          </li>
        ))}
      </ul>
    </div>
  );
}

const NOUN: Partial<Record<SlideLayoutId, string>> = { cards: "Thẻ", steps: "Bước", stats: "Số liệu", summary: "Dòng" };

export default function LayoutEditor({
  config,
  themeId,
  onSave,
  deckId,
  slideId,
  onApplyProposal,
  onSplit,
  open,
  onOpenChange,
  nav,
  zoom = 1,
  sourceKind = null,
}: {
  /** Nguồn của bài (document | topic | topic_web): bài từ mô tả chủ đề nhắc câu trả lời AI dựa trên kiến thức chung. */
  sourceKind?: string | null;
  /** Mức thu phóng của khung xem trước (1 = vừa khung; lớn hơn thì chữ to thật và cuộn để xem tiếp). */
  zoom?: number;
  config: Cfg;
  themeId?: string | null;
  onSave: Save;
  deckId: string;
  slideId: string;
  /** Cửa sổ sửa đang mở (trạng thái nằm ở trình sửa bài giảng để giữ mở khi chuyển slide). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Vị trí slide trong bài và nút ‹ › sang slide kế bên (null = đã ở đầu hoặc cuối). */
  nav: { index: number; total: number; onPrev: (() => void) | null; onNext: (() => void) | null };
  /** Giảng viên chấp nhận đề xuất của AI (đổi nội dung, có thể đổi loại slide). */
  onApplyProposal: (p: Proposal, action: string) => void;
  /** Tách slide quá dài thành hai: nhận cấu hình hai slide mới. `aiAction`: slide đầu là đề xuất AI đã chấp nhận. */
  onSplit: (a: Cfg, b: Cfg, opts?: { aiAction?: string }) => void;
}) {
  const layout = resolveLayout(config);
  const [d, setD] = useState<Cfg>(() => padForEditing(layout, config));
  const [palette, setPalette] = useState(-1);
  const [richOn, setRichOn] = useState(false);
  const focused = useRef<FieldCtl | null>(null);
  const range = ITEM_RANGE[layout];

  const commit = (next: Cfg = d) => onSave({ config: { ...sanitizeLayoutConfig(layout, next), ...extrasFor(config, next) } });
  const set = (patch: Cfg) => setD((prev) => ({ ...prev, ...patch }));
  // Lưới ô của Bảng và Biểu đồ: gõ thì chỉ cập nhật bản nháp (lưu khi rời ô); dán, thêm, xoá thì lưu ngay.
  const dataChange = (patch: Cfg, commitNow?: boolean) => {
    const next = { ...d, ...patch };
    setD(next);
    if (commitNow) commit(next);
  };
  const blur = () => commit();

  // Xem trước đúng như sẽ lưu: mục còn trống không hiện.
  // Hoa văn là khoá meta của slide (không nằm trong ô sửa): ghép vào bản xem trước để thấy đúng như khi chiếu.
  // Kiểu bìa cũng là khoá meta, đổi bằng hàng chọn riêng và lưu ngay.
  const savedMotif = typeof config.motif === "string" ? config.motif : undefined;
  const savedCoverStyle = typeof config.coverStyle === "string" ? config.coverStyle : undefined;
  const preview = useMemo(
    () => ({
      ...sanitizeLayoutConfig(layout, d),
      ...(savedMotif ? { motif: savedMotif } : {}),
      ...(savedCoverStyle ? { coverStyle: savedCoverStyle } : {}),
    }),
    [layout, d, savedMotif, savedCoverStyle],
  );
  // Bản vẽ: như sẽ lưu, kèm dòng nguồn ở chân slide (khoá meta, sanitizeLayoutConfig không giữ).
  const shown = useMemo(() => (typeof d.cite === "string" && d.cite.trim() ? { ...preview, cite: d.cite.trim() } : preview), [preview, d.cite]);
  const effectiveMotif = useSlideMotif(preview, slideId);
  const inheritedMotif = useSlideMotif({ ...preview, motif: undefined }, slideId);
  /** Đổi hoa văn của slide: lưu ngay cùng chữ đang soạn; null = theo bài giảng. */
  const setMotif = (v: string | null) => {
    const next: Cfg = { ...sanitizeLayoutConfig(layout, d), ...keepExtras(config) };
    if (v) next.motif = v;
    else delete next.motif;
    onSave({ config: next });
  };
  /** Đổi kiểu bìa: lưu ngay cùng chữ đang soạn. */
  const setCoverStyle = (v: string) => onSave({ config: { ...sanitizeLayoutConfig(layout, d), ...keepExtras(config), coverStyle: v } });
  const problems = useMemo(() => layoutTextProblems(layout, preview), [layout, preview]);
  const split = useMemo(() => (problems.length ? splitSlideConfig({ ...preview, ...pickMeta(config) }) : null), [problems, preview, config]);

  const items: LayoutItem[] = d.items ?? [];
  const setItem = (i: number, patch: Partial<LayoutItem>) =>
    set({ items: items.map((it, k) => (k === i ? { ...it, ...patch } : it)) });
  const columns: LayoutColumn[] = d.columns ?? [];
  const setCol = (i: number, patch: Partial<LayoutColumn>) =>
    set({ columns: columns.map((c, k) => (k === i ? { ...c, ...patch } : c)) });

  const [tab, setTab] = useState<"edit" | "ai">("edit");
  // Màn "Vẽ lại thành biểu đồ" (docs/tieu-chi/bieu-do-kho-doc-pptx.md, V2–V10). Số AI đọc chỉ nằm trong màn đó;
  // đổi slide hay đóng cửa sổ là bỏ.
  const [redraw, setRedraw] = useState(false);
  useEffect(() => setRedraw(false), [slideId, open]);
  const [ready, setReady] = useState(false);
  const dlgRef = useRef<HTMLDialogElement>(null);
  const ctx = useMemo(
    () => ({
      focus: (c: FieldCtl | null) => {
        focused.current = c ?? focused.current;
        setRichOn(c !== null);
      },
      ready,
    }),
    [ready],
  );

  // Đổi bố cục: nạp lại các ô theo nội dung đã chuyển đổi (trước đây làm bằng key, nhưng key làm cửa sổ đóng mở lại).
  useEffect(() => {
    setD(padForEditing(layout, config));
    setPalette(-1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  useEffect(() => {
    if (!open) {
      setReady(false);
      return;
    }
    const dlg = dlgRef.current;
    if (dlg && !dlg.open) dlg.showModal();
    // Đặt con trỏ vào ô đầu tiên để gõ ngay, thay vì dừng ở nút ‹.
    dlg?.querySelector<HTMLElement>("input.input, textarea")?.focus();
    setReady(true);
  }, [open]);

  // Chốt nội dung khi đóng cửa sổ (Esc, bấm ra ngoài hoặc Xong), chỉ lưu khi có thay đổi.
  const finish = () => {
    const next = { ...sanitizeLayoutConfig(layout, d), ...extrasFor(config, d) };
    if (!slideConfigsEqual(next, config)) onSave({ config: next });
    onOpenChange(false);
  };
  const format = useCallback((marker: "**" | "*") => {
    const c = focused.current;
    if (!c || !c.el.isConnected) return;
    const { value, max, onChange } = c.latest.current;
    const r = toggleInlineMarker(value, c.el.selectionStart ?? 0, c.el.selectionEnd ?? 0, marker);
    if (r.value === value || r.value.length > max) return;
    onChange(r.value);
    requestAnimationFrame(() => {
      c.el.focus();
      c.el.setSelectionRange(r.start, r.end);
    });
  }, []);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    const k = e.key.toLowerCase();
    if ((k === "b" || k === "i") && focused.current && e.target === focused.current.el) {
      e.preventDefault();
      format(k === "b" ? "**" : "*");
    }
  };

  const noun = NOUN[layout] ?? "Dòng";
  // Cột chỉ khi ô sửa đủ rộng: từ lg bảng sửa chỉ rộng 460 px nên xếp dọc.
  const cols = layout === "cards" || layout === "stats" ? "md:grid-cols-3 lg:grid-cols-1" : "";

  // Hỏi đáp với AI: đề xuất đang chờ hiện trên bản xem trước lớn (Trước / Sau), chỉ ghi vào slide khi bấm Áp dụng.
  const chat = useSlideAiChat(deckId, slideId);
  const pend = chat.pending;
  const showAfter = !!pend && chat.view === "after";
  const decide = (kind: "apply" | "discard") => {
    const p = chat.settle(kind === "apply" ? "applied" : "discarded");
    if (!p || kind !== "apply") return;
    // Làm mới các ô nhập theo đề xuất (cùng bố cục); đổi loại slide thì trình soạn tự đổi theo.
    if (p.proposal.type === "content") setD(padForEditing(layout, p.proposal.config));
    onApplyProposal(p.proposal, p.action);
  };
  // Bản xem trước là phần chính của cửa sổ sửa: lấp vùng trái, co vừa khung, cập nhật từng ký tự gõ.
  const stage = (
    <section className="flex min-h-0 flex-col gap-2 bg-[rgb(var(--surface-muted))] p-3 lg:p-5" aria-label="Xem trước">
      <div className="flex items-center justify-between text-[13px] text-faint">
        <span>Xem trước</span>
        <span className={problems.length > 0 ? "font-semibold text-amber-800" : ""}>{problems.length > 0 ? "Slide dài" : "Độ dài vừa"}</span>
      </div>
      {pend && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-brand-500 bg-[rgb(var(--surface))] px-3 py-2" role="region" aria-label="Đề xuất của AI">
          <b className="text-sm">{pend.proposal.type === "quiz" ? "Đề xuất: đổi thành câu hỏi quiz" : "Đề xuất của AI"}</b>
          <span className="inline-flex rounded-full border border-token p-0.5 text-[13px]" role="group" aria-label="Xem bản">
            {(["before", "after"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={chat.view === v}
                onClick={() => chat.setView(v)}
                className={`rounded-full px-3 py-0.5 font-medium ${chat.view === v ? "bg-brand-600 text-white" : "text-muted"}`}
              >
                {v === "before" ? "Trước" : "Sau"}
              </button>
            ))}
          </span>
          <span className="flex-1" />
          <button type="button" className="btn-secondary px-3 py-1 text-sm" onClick={() => decide("discard")}>
            Bỏ
          </button>
          <button type="button" className="btn-primary flex items-center gap-1 px-3 py-1 text-sm" onClick={() => decide("apply")}>
            <Check size={14} /> Áp dụng
          </button>
        </div>
      )}
      <div className="relative min-h-0 flex-1 max-lg:h-[34vh] max-lg:min-h-[190px] max-lg:flex-none">
        {showAfter && pend!.proposal.type === "quiz" ? (
          <div className="absolute inset-0 grid place-items-center overflow-auto p-2">
            <div className="w-full max-w-xl">
              <QuizPreview config={pend!.proposal.config} />
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex">
            <LayoutSlideView config={showAfter ? pend!.proposal.config : shown} themeId={themeId} slideId={slideId} frame />
          </div>
        )}
      </div>
    </section>
  );
  // Khung xem trước lấp đầy vùng giữa; viền khung hình 16:9 do bộ vẽ slide tự vẽ.
  const previewBox = (
    <div className="absolute inset-0 flex">
      <LayoutSlideView config={shown} themeId={themeId} slideId={slideId} zoom={zoom} frame />
    </div>
  );

  const dialog =
    open && typeof document !== "undefined"
      ? createPortal(
          <dialog
            ref={dlgRef}
            aria-labelledby="layout-dlg-title"
            onClose={finish}
            onClick={(e) => {
              if (e.target === dlgRef.current) dlgRef.current?.close();
            }}
            onKeyDown={onKeyDown}
            className="m-auto h-[min(920px,94vh)] w-[min(1600px,96vw)] max-w-none overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))] p-0 text-[rgb(var(--text))] shadow-2xl backdrop:bg-black/50 max-sm:m-0 max-sm:h-[100dvh] max-sm:max-h-none max-sm:w-screen max-sm:rounded-none max-sm:border-0"
          >
            <FormatCtx.Provider value={ctx}>
              {redraw ? (
                <ChartFromImagePanel
                  deckId={deckId}
                  slideId={slideId}
                  config={{ ...sanitizeLayoutConfig(layout, d), ...extrasFor(config, d) }}
                  themeId={themeId}
                  onBack={() => setRedraw(false)}
                  onApply={(chart, cont) => {
                    setRedraw(false);
                    if (cont) onSplit(chart, cont, { aiAction: "chart_from_image" });
                    else onApplyProposal({ type: "content", config: chart }, "chart_from_image");
                  }}
                />
              ) : (
              <div className="flex h-full flex-col">
                <div className="flex shrink-0 items-center gap-2 border-b border-token px-4 py-2.5">
                  <button type="button" className="btn-secondary h-9 w-9 !p-0" disabled={!nav.onPrev} onClick={() => nav.onPrev?.()} aria-label="Slide trước">
                    <ChevronLeft size={18} />
                  </button>
                  <button type="button" className="btn-secondary h-9 w-9 !p-0" disabled={!nav.onNext} onClick={() => nav.onNext?.()} aria-label="Slide sau">
                    <ChevronRight size={18} />
                  </button>
                  <h2 id="layout-dlg-title" className="flex-1 text-lg font-bold">
                    Slide {nav.index + 1} / {nav.total}
                  </h2>
                  <button type="button" className="btn-primary h-9" onClick={() => dlgRef.current?.close()}>
                    Xong
                  </button>
                </div>

                {/* Màn rộng: xem trước lớn bên trái, bảng sửa 460 px bên phải. Màn hẹp: xem trước ở trên, bảng sửa ở dưới. */}
                <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_460px] lg:grid-rows-1">
                  {stage}

                  <div className="flex min-h-0 flex-col border-token max-lg:border-t lg:border-l">
                    <div className="flex shrink-0 gap-1 border-b border-token bg-[rgb(var(--surface))] px-4 pt-2" role="tablist" aria-label="Phần sửa">
                      {(
                        [
                          ["edit", "Nội dung"],
                          ["ai", "Nhờ AI"],
                        ] as const
                      ).map(([k, label]) => (
                        <button
                          key={k}
                          type="button"
                          role="tab"
                          aria-selected={tab === k}
                          onClick={() => setTab(k)}
                          className={`-mb-px flex items-center gap-1.5 border-b-[3px] px-4 py-2 text-[15px] font-semibold ${
                            tab === k ? "border-brand-600 text-[rgb(var(--text))]" : "border-transparent text-muted hover:text-[rgb(var(--text))]"
                          }`}
                        >
                          {k === "ai" && <Sparkles size={15} aria-hidden />}
                          {label}
                        </button>
                      ))}
                    </div>

                    {tab === "edit" ? (
                      <div className="min-h-0 flex-1 overflow-y-auto">
                      <div className="space-y-4 p-4" role="tabpanel" aria-label="Nội dung slide">
          <LayoutPicker config={config} onSave={onSave} draft={preview} />

          <div
            className="flex flex-wrap items-center gap-2 rounded-xl border border-token px-3 py-2"
            role="toolbar"
            aria-label="Định dạng chữ"
          >
            <span className="flex overflow-hidden rounded-lg border border-token">
              <button
                type="button"
                disabled={!richOn}
                title="In đậm (Ctrl+B)"
                aria-label="In đậm"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => format("**")}
                className="grid h-9 w-10 place-items-center bg-[rgb(var(--surface))] hover:bg-[rgb(var(--surface-muted))] disabled:opacity-40"
              >
                <Bold size={16} />
              </button>
              <button
                type="button"
                disabled={!richOn}
                title="In nghiêng (Ctrl+I)"
                aria-label="In nghiêng"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => format("*")}
                className="grid h-9 w-10 place-items-center border-l border-token bg-[rgb(var(--surface))] hover:bg-[rgb(var(--surface-muted))] disabled:opacity-40"
              >
                <Italic size={16} />
              </button>
            </span>
            <span className="text-[13px] text-muted">Bôi đen chữ trong một ô rồi bấm để định dạng</span>
          </div>

          {problems.length > 0 && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                Slide này dài ({problems.join(", ")}): chữ đã tự thu nhỏ đến mức nhỏ nhất vẫn dễ đọc. Hãy viết ngắn lại hoặc
                tách thành hai slide.
                {split && (
                  <button
                    type="button"
                    className="ml-2 rounded-full border border-amber-700 px-2.5 py-0.5 text-xs font-semibold hover:bg-amber-100"
                    onClick={() => onSplit(split[0], split[1])}
                  >
                    Tách thành hai slide
                  </button>
                )}
              </span>
            </p>
          )}

          <div className="grid gap-3">
            {/* Bìa: bốn ô theo đúng thứ tự trên slide. Đơn vị và người trình bày được điền sẵn từ tên trường và hồ sơ. */}
            {layout === "cover" && (
              <Field
                label="Tên đơn vị"
                value={d.org ?? ""}
                max={MAX_LEN.org}
                placeholder="Khoa Công nghệ thông tin, Trường Công nghệ"
                onChange={(v) => set({ org: v })}
                onBlur={blur}
              />
            )}
            {layout !== "quote" && (
              <Field
                label={layout === "cover" ? "Tên bài học" : "Tiêu đề"}
                value={d.title ?? ""}
                max={MAX_LEN.title}
                onChange={(v) => set({ title: v })}
                onBlur={blur}
              />
            )}

            {(layout === "cover" || layout === "section") && (
              <Field
                label={layout === "cover" ? "Phụ đề" : "Câu dẫn"}
                value={d.subtitle ?? ""}
                max={MAX_LEN.subtitle}
                multiline
                onChange={(v) => set({ subtitle: v })}
                onBlur={blur}
              />
            )}
            {layout === "cover" && (
              <Field
                label="Người trình bày"
                value={d.byline ?? ""}
                max={MAX_LEN.byline}
                placeholder="TS. Nguyễn Văn A"
                onChange={(v) => set({ byline: v })}
                onBlur={blur}
              />
            )}
            {layout === "section" && (
              <Field
                label="Số mục"
                plain
                value={d.sectionNumber ?? ""}
                max={MAX_LEN.sectionNumber}
                onChange={(v) => set({ sectionNumber: v })}
                onBlur={blur}
              />
            )}

            {layout === "image" && (
              <>
                {/* Vừa đổi bố cục (vd "Trả lại hình" từ Biểu đồ) thì bản nháp còn là của bố cục cũ một lượt vẽ, chưa có ô ý. */}
                {((d.bullets as string[] | undefined) ?? []).map((b, i) => (
                  <Field
                    key={i}
                    label={`Ý ${i + 1}`}
                    value={b}
                    max={MAX_LEN.bullet}
                    multiline
                    onChange={(v) => set({ bullets: (d.bullets as string[]).map((x, k) => (k === i ? v : x)) })}
                    onBlur={blur}
                  />
                ))}
                <Field
                  label="Địa chỉ ảnh (để trống thì dùng hình minh hoạ mặc định)"
                  plain
                  value={d.imageUrl ?? ""}
                  max={2000}
                  onChange={(v) => set({ imageUrl: v })}
                  onBlur={blur}
                />
                {canRedraw(config) && d.imageUrl === config.imageUrl && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <button
                      type="button"
                      className="btn-secondary h-9"
                      onClick={() => {
                        // Chốt chữ đang gõ (nếu có) để slide "(tiếp)" mang đúng các ý hiện tại.
                        const next = { ...sanitizeLayoutConfig(layout, d), ...extrasFor(config, d) };
                        if (!slideConfigsEqual(next, config)) onSave({ config: next });
                        setRedraw(true);
                      }}
                    >
                      <BarChart3 size={16} aria-hidden /> Vẽ lại thành biểu đồ
                    </button>
                    <span className="min-w-[220px] flex-1 text-[13px] text-muted">
                      Hình là biểu đồ? AI đọc số trong hình, thầy cô đối chiếu từng dòng rồi mới thay hình.
                    </span>
                  </div>
                )}
              </>
            )}

            {range && (
              <div className={`grid gap-3 ${cols}`}>
                {items.map((it, i) => (
                  <div key={i} className="grid content-start gap-2 rounded-xl border border-token p-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted">
                      <span>
                        {noun} {i + 1}
                      </span>
                      <span className="flex-1" />
                      {layout === "cards" && (
                        <button
                          type="button"
                          aria-label={`Đổi biểu tượng thẻ ${i + 1}, đang là ${ICON_LABELS[it.icon ?? "target"]}`}
                          title={`Biểu tượng: ${ICON_LABELS[it.icon ?? "target"]}`}
                          aria-expanded={palette === i}
                          onClick={() => setPalette(palette === i ? -1 : i)}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-token text-brand-700 hover:bg-[rgb(var(--surface-muted))]"
                        >
                          {(() => {
                            const Ic = LAYOUT_ICONS[it.icon ?? "target"];
                            return <Ic size={16} />;
                          })()}
                        </button>
                      )}
                      {items.length > range.min && (
                        <button
                          type="button"
                          aria-label={`Xoá ${noun.toLowerCase()} ${i + 1}`}
                          className="text-faint hover:text-red-600"
                          onClick={() => {
                            const next = items.filter((_, k) => k !== i);
                            set({ items: next });
                            setPalette(-1);
                            commit({ ...d, items: next });
                          }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    {layout === "cards" && palette === i && (
                      <div role="group" aria-label="Chọn biểu tượng" className="grid grid-cols-4 gap-1">
                        {SLIDE_ICONS.map((ic) => {
                          const Ic = LAYOUT_ICONS[ic];
                          return (
                            <button
                              key={ic}
                              type="button"
                              aria-pressed={(it.icon ?? "target") === ic}
                              aria-label={ICON_LABELS[ic]}
                              title={ICON_LABELS[ic]}
                              onClick={() => {
                                const next = items.map((x, k) => (k === i ? { ...x, icon: ic } : x));
                                set({ items: next });
                                setPalette(-1);
                                commit({ ...d, items: next });
                              }}
                              className={`grid h-9 place-items-center rounded-lg border ${
                                (it.icon ?? "target") === ic ? "border-brand-600 bg-brand-soft text-brand-700" : "border-token text-muted hover:bg-[rgb(var(--surface-muted))]"
                              }`}
                            >
                              <Ic size={18} />
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <Field
                      label={layout === "stats" ? "Con số" : layout === "summary" ? "Nội dung" : "Tiêu đề"}
                      plain={layout === "stats"}
                      value={it.heading}
                      max={layout === "stats" ? MAX_LEN.statValue : layout === "summary" ? MAX_LEN.itemBody : MAX_LEN.itemHeading}
                      multiline={layout === "summary"}
                      onChange={(v) => setItem(i, { heading: v })}
                      onBlur={blur}
                    />
                    {layout !== "summary" && (
                      <Field
                        label="Câu giải thích"
                        value={it.body}
                        max={MAX_LEN.itemBody}
                        multiline
                        onChange={(v) => setItem(i, { body: v })}
                        onBlur={blur}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {range && items.length < range.max && (
              <button
                type="button"
                className="flex w-fit items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
                onClick={() => set({ items: [...items, { heading: "", body: "" }] })}
              >
                <Plus size={14} /> Thêm {noun.toLowerCase()}
              </button>
            )}

            {layout === "steps" && (
              <Field
                label="Dòng cuối (tuỳ chọn)"
                value={d.footnote ?? ""}
                max={MAX_LEN.footnote}
                placeholder="Vòng lặp được lặp lại sau mỗi bài tập."
                onChange={(v) => set({ footnote: v })}
                onBlur={blur}
              />
            )}

            {typeof config.cite === "string" && config.cite && (
              <Field
                label="Dòng nguồn ở chân slide"
                value={typeof d.cite === "string" ? d.cite : ""}
                max={MAX_LEN.source}
                placeholder="Để trống nếu slide không dùng thông tin từ nguồn"
                onChange={(v) => set({ cite: v })}
                onBlur={blur}
              />
            )}

            {layout === "compare" && (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1">
                {columns.map((col, i) => (
                  <div key={i} className="grid content-start gap-2 rounded-xl border border-token p-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-muted">
                      <span>Cột {i + 1}</span>
                      <select
                        className="input py-0.5 text-xs"
                        aria-label={`Loại cột ${i + 1}`}
                        value={col.tone}
                        onChange={(e) => {
                          const next = columns.map((c, k) => (k === i ? { ...c, tone: e.target.value as LayoutColumn["tone"] } : c));
                          set({ columns: next });
                          commit({ ...d, columns: next });
                        }}
                      >
                        <option value="bad">Cách chưa tốt</option>
                        <option value="good">Cách tốt</option>
                      </select>
                    </div>
                    <Field label="Tên cột" value={col.heading} max={MAX_LEN.columnHeading} onChange={(v) => setCol(i, { heading: v })} onBlur={blur} />
                    {col.points.map((p, k) => (
                      <Field
                        key={k}
                        label={`Ví dụ ${k + 1}`}
                        value={p}
                        max={MAX_LEN.columnPoint}
                        multiline
                        onChange={(v) => setCol(i, { points: col.points.map((x, j) => (j === k ? v : x)) })}
                        onBlur={blur}
                      />
                    ))}
                    {col.points.length < 3 && (
                      <button
                        type="button"
                        className="flex w-fit items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                        onClick={() => setCol(i, { points: [...col.points, ""] })}
                      >
                        <Plus size={14} /> Thêm ví dụ
                      </button>
                    )}
                    <Field label="Nhận xét cuối cột" value={col.note} max={MAX_LEN.columnNote} onChange={(v) => setCol(i, { note: v })} onBlur={blur} />
                  </div>
                ))}
              </div>
            )}

            {layout === "chart" && restoreImage(config) && (
              <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
                <span>Vẽ lại từ hình gốc ·</span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline"
                  onClick={() => onSave({ config: restoreImage({ ...config, title: d.title ?? config.title })! })}
                >
                  <Undo2 size={14} aria-hidden /> Trả lại hình
                </button>
              </p>
            )}
            {layout === "table" && <TableSheet d={d} onChange={dataChange} onBlur={blur} />}
            {layout === "chart" && (
              <>
                <ChartSheet d={d} onChange={dataChange} onBlur={blur} />
                <Field label="Đơn vị" plain value={d.unit ?? ""} max={MAX_LEN.unit} placeholder="%, điểm, học viên" onChange={(v) => set({ unit: v })} onBlur={blur} />
              </>
            )}
            {(layout === "table" || layout === "chart") && (
              <Field
                label="Nguồn (để trống thì slide không hiện dòng nguồn)"
                plain
                value={d.source ?? ""}
                max={MAX_LEN.source}
                placeholder="Tên tài liệu, năm"
                onChange={(v) => set({ source: v })}
                onBlur={blur}
              />
            )}

            {layout === "quote" && (
              <>
                <Field label="Câu trích dẫn" value={d.quote ?? ""} max={MAX_LEN.quote} multiline onChange={(v) => set({ quote: v })} onBlur={blur} />
                <Field label="Nguồn hoặc thông điệp" value={d.source ?? ""} max={MAX_LEN.source} onChange={(v) => set({ source: v })} onBlur={blur} />
              </>
            )}

            {layout === "cover" && <CoverStylePicker config={preview} themeId={themeId} slideId={slideId} onChange={setCoverStyle} />}

            {/* Chỉ bốn bố cục có chỗ trống cho hoa văn; Chữ và hình đã có ảnh thì không. Riêng ô hình (Chữ và hình
                chưa có ảnh) chọn được thêm hình minh hoạ theo chủ đề. */}
            {motifSlot(preview) && (
              <SlideMotifField
                value={savedMotif}
                illustrations={motifSlot(preview) === "fill"}
                effective={effectiveMotif?.motif ?? null}
                inherited={inheritedMotif?.motif ?? null}
                themeId={themeId}
                onChange={setMotif}
              />
            )}
          </div>
                      </div>
                    </div>
                    ) : (
                      <AiChatPanel
                        chat={chat}
                        hasOutline={typeof config.outlineId === "string" && !!config.outlineId}
                        generalKnowledge={sourceKind === "topic" || sourceKind === "topic_web"}
                        onDecide={decide}
                      />
                    )}
                  </div>
                </div>
              </div>
              )}
            </FormatCtx.Provider>
          </dialog>,
          document.body,
        )
      : null;

  return (
    <>
      {/* Ngoài cửa sổ chỉ có slide, lấp đầy vùng giữa; bấm vào slide hoặc nút bút để sửa. */}
      <section className="flex min-h-0 flex-1 flex-col gap-2" aria-label="Slide">
        <div
          role="button"
          tabIndex={0}
          aria-label="Sửa slide này"
          title="Bấm vào slide để sửa"
          onClick={() => onOpenChange(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpenChange(true);
            }
          }}
          className={`group relative min-h-[240px] w-full flex-1 cursor-pointer rounded-xl focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-brand-600 ${
            problems.length > 0 ? "outline outline-[3px] outline-amber-400" : ""
          }`}
        >
          {previewBox}
          <button
            type="button"
            aria-label="Sửa slide này"
            onClick={(e) => {
              e.stopPropagation();
              onOpenChange(true);
            }}
            className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full border border-token bg-[rgb(var(--surface))] py-1.5 pl-2.5 pr-3.5 text-sm font-semibold shadow-md"
          >
            <Pencil size={16} /> Sửa
          </button>
        </div>
        {problems.length > 0 && (
          <p className="text-center text-xs font-semibold text-amber-800">Slide này dài; mở phần sửa để viết ngắn lại hoặc tách thành hai slide.</p>
        )}
      </section>
      {dialog}
    </>
  );
}
