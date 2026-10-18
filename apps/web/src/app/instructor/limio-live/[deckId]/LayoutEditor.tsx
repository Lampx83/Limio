"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Bold, Check, ChevronLeft, ChevronRight, Italic, Loader2, Pencil, Plus, Sparkles, X } from "lucide-react";
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
import { slideBgFor } from "../slideThemes";
import { motifSlot } from "@/lib/limioLiveMotifs";
import { useSlideMotif } from "../liveMotifContext";
import { SlideMotifField } from "./MotifPicker";
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

type EditAction = "shorter" | "example" | "simpler" | "to_quiz" | "rewrite";
interface Proposal {
  type: "content" | "quiz";
  config: Cfg;
}

const AI_ACTIONS: Array<{ id: EditAction; label: string; hint: string }> = [
  { id: "shorter", label: "Viết ngắn hơn", hint: "Rút gọn câu chữ, giữ ý chính" },
  { id: "example", label: "Thêm ví dụ", hint: "Bổ sung một ví dụ cụ thể" },
  { id: "simpler", label: "Dễ hiểu hơn", hint: "Dùng từ giản dị hơn" },
  { id: "to_quiz", label: "Đổi thành câu hỏi quiz", hint: "Biến nội dung thành một câu hỏi" },
];

const AI_ERROR: Record<string, string> = {
  openai_not_configured: "Hệ thống AI chưa được cấu hình. Vui lòng báo quản trị viên.",
  global_token_cap: "Hệ thống AI đang quá tải hôm nay. Bạn vẫn có thể sửa tay.",
  daily_token_cap: "Bạn đã dùng hết hạn mức AI hôm nay. Bạn vẫn có thể sửa tay.",
  monthly_token_cap: "Bạn đã dùng hết hạn mức AI của tháng này. Bạn vẫn có thể sửa tay.",
  ai_edit_failed: "AI chưa viết lại được slide này. Hãy thử lại hoặc sửa tay.",
  no_outline_row: "Slide này không còn dòng dàn ý gốc để viết lại.",
};

/** Nhờ AI sửa một slide: bấm nút → xem bản so sánh → chấp nhận hoặc bỏ. Không bao giờ tự ghi vào slide. */
function AiEditBar({
  deckId,
  slideId,
  config,
  themeId,
  onApply,
}: {
  deckId: string;
  slideId: string;
  config: Cfg;
  themeId?: string | null;
  onApply: (p: Proposal, action: EditAction) => void;
}) {
  const [busy, setBusy] = useState<EditAction | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [proposalAction, setProposalAction] = useState<EditAction>("shorter");

  const run = async (action: EditAction) => {
    setBusy(action);
    setErr(null);
    try {
      const res = await fetch(apiUrl(`/api/instructor/limio-live/decks/${deckId}/slides/${slideId}/ai-edit`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = (await res.json().catch(() => null)) as { proposal?: Proposal; error?: string } | null;
      if (!res.ok || !j?.proposal) return setErr(AI_ERROR[j?.error ?? ""] ?? "Không nhờ AI được lúc này. Vui lòng thử lại.");
      setProposal(j.proposal);
      setProposalAction(action);
    } catch {
      setErr("Mất kết nối. Vui lòng kiểm tra mạng rồi thử lại.");
    } finally {
      setBusy(null);
    }
  };

  const actions = config.outlineId ? [...AI_ACTIONS, { id: "rewrite" as const, label: "Viết lại từ dàn ý", hint: "Quay về ý trong dàn ý đã xác nhận" }] : AI_ACTIONS;


  return (
    <section className="space-y-3 rounded-2xl border border-token p-4" aria-label="Nhờ AI sửa slide">
      <div>
        <h3 className="flex items-center gap-1.5 text-sm font-bold">
          <Sparkles size={14} /> Nhờ AI sửa slide này
        </h3>
        <p className="mt-0.5 text-[13px] text-muted">
          AI chỉ đề xuất. Bạn xem bản so sánh rồi mới chấp nhận, không có gì tự ghi vào slide.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Việc nhờ AI">
        {actions.map((a) => (
          <button
            key={a.id}
            type="button"
            disabled={busy !== null || proposal !== null}
            onClick={() => run(a.id)}
            className="flex items-start gap-2 rounded-xl border border-token px-3 py-2 text-left transition hover:border-brand-600 disabled:opacity-50"
          >
            {busy === a.id ? <Loader2 size={14} className="mt-0.5 shrink-0 animate-spin" /> : null}
            <span className="grid leading-tight">
              <b className="text-sm">{a.label}</b>
              <small className="text-xs text-muted">{a.hint}</small>
            </span>
          </button>
        ))}
      </div>
      {err && <p className="text-xs font-medium text-red-700">{err}</p>}

      {proposal && (
        <div className="space-y-3 rounded-xl border-2 border-brand-300 bg-brand-50/40 p-3" role="region" aria-label="Đề xuất của AI">
          <p className="text-sm font-semibold">Đề xuất của AI (chưa áp dụng)</p>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-semibold text-muted">Hiện tại</p>
              <Thumb config={config} themeId={themeId} slideId={slideId} />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-muted">
                {proposal.type === "quiz" ? "Đề xuất: câu hỏi quiz" : "Đề xuất"}
              </p>
              {proposal.type === "quiz" ? <QuizPreview config={proposal.config} /> : <Thumb config={proposal.config} themeId={themeId} slideId={slideId} />}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-primary flex items-center gap-1.5 text-sm"
              onClick={() => {
                onApply(proposal, proposalAction);
                setProposal(null);
              }}
            >
              <Check size={14} /> Dùng đề xuất
            </button>
            <button type="button" className="btn-secondary text-sm" onClick={() => setProposal(null)}>
              Bỏ đề xuất
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Thumb({ config, themeId, slideId }: { config: Cfg; themeId?: string | null; slideId?: string }) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-black/10" style={{ background: slideBgFor(themeId, true) }}>
      <div className="absolute inset-0 flex">
        <LayoutSlideView config={config} themeId={themeId} slideId={slideId} />
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
}: {
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
  /** Tách slide quá dài thành hai: nhận cấu hình hai slide mới. */
  onSplit: (a: Cfg, b: Cfg) => void;
}) {
  const layout = resolveLayout(config);
  const [d, setD] = useState<Cfg>(() => padForEditing(layout, config));
  const [palette, setPalette] = useState(-1);
  const [richOn, setRichOn] = useState(false);
  const focused = useRef<FieldCtl | null>(null);
  const range = ITEM_RANGE[layout];

  const commit = (next: Cfg = d) => onSave({ config: { ...sanitizeLayoutConfig(layout, next), ...keepExtras(config) } });
  const set = (patch: Cfg) => setD((prev) => ({ ...prev, ...patch }));
  const blur = () => commit();

  // Xem trước đúng như sẽ lưu: mục còn trống không hiện.
  // Hoa văn là khoá meta của slide (không nằm trong ô sửa): ghép vào bản xem trước để thấy đúng như khi chiếu.
  const savedMotif = typeof config.motif === "string" ? config.motif : undefined;
  const preview = useMemo(
    () => ({ ...sanitizeLayoutConfig(layout, d), ...(savedMotif ? { motif: savedMotif } : {}) }),
    [layout, d, savedMotif],
  );
  const effectiveMotif = useSlideMotif(preview, slideId);
  const inheritedMotif = useSlideMotif({ ...preview, motif: undefined }, slideId);
  /** Đổi hoa văn của slide: lưu ngay cùng chữ đang soạn; null = theo bài giảng. */
  const setMotif = (v: string | null) => {
    const next: Cfg = { ...sanitizeLayoutConfig(layout, d), ...keepExtras(config) };
    if (v) next.motif = v;
    else delete next.motif;
    onSave({ config: next });
  };
  const problems = useMemo(() => layoutTextProblems(layout, preview), [layout, preview]);
  const split = useMemo(() => (problems.length ? splitSlideConfig({ ...preview, ...pickMeta(config) }) : null), [problems, preview, config]);

  const items: LayoutItem[] = d.items ?? [];
  const setItem = (i: number, patch: Partial<LayoutItem>) =>
    set({ items: items.map((it, k) => (k === i ? { ...it, ...patch } : it)) });
  const columns: LayoutColumn[] = d.columns ?? [];
  const setCol = (i: number, patch: Partial<LayoutColumn>) =>
    set({ columns: columns.map((c, k) => (k === i ? { ...c, ...patch } : c)) });

  const [tab, setTab] = useState<"edit" | "ai">("edit");
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
    const next = { ...sanitizeLayoutConfig(layout, d), ...keepExtras(config) };
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
  // Cột chỉ khi ô sửa đủ rộng: ở lg và 2xl cột phải hẹp nên xếp dọc.
  const cols = layout === "cards" || layout === "stats" ? "md:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3 2xl:grid-cols-1" : "";

  // Bản thu nhỏ trong cửa sổ sửa: khung 16:9 cố định, vừa chiều rộng cột.
  const thumbBox = (
    <div
      className="relative aspect-video w-full overflow-hidden rounded-xl border border-black/10 shadow-sm"
      style={{ background: slideBgFor(themeId, true) }}
    >
      <div className="absolute inset-0 flex">
        <LayoutSlideView config={preview} themeId={themeId} slideId={slideId} />
      </div>
    </div>
  );
  // Khung xem trước lấp đầy vùng giữa; viền khung hình 16:9 do bộ vẽ slide tự vẽ.
  const previewBox = (
    <div className="absolute inset-0 flex">
      <LayoutSlideView config={preview} themeId={themeId} slideId={slideId} zoom={zoom} frame />
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
            className="m-auto h-[min(780px,94vh)] w-[min(1120px,96vw)] max-w-none overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))] p-0 text-[rgb(var(--text))] shadow-2xl backdrop:bg-black/50 max-sm:m-0 max-sm:h-[100dvh] max-sm:max-h-none max-sm:w-screen max-sm:rounded-none max-sm:border-0"
          >
            <FormatCtx.Provider value={ctx}>
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

                <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[minmax(0,1fr)_320px] md:grid-rows-1">
                  {/* Xem trước thu nhỏ ở góc: vẫn cập nhật từng ký tự gõ. */}
                  <aside className="mx-auto w-full max-w-[300px] px-4 pt-3 md:order-2 md:max-w-none md:self-start md:px-4 md:py-4 md:pl-0" aria-label="Xem trước">
                    <div className="mb-1 flex items-center justify-between text-[13px] text-faint">
                      <span>Xem trước</span>
                      <span className={problems.length > 0 ? "font-semibold text-amber-800" : ""}>{problems.length > 0 ? "Slide dài" : "Độ dài vừa"}</span>
                    </div>
                    {thumbBox}
                  </aside>

                  <div className="min-h-0 overflow-y-auto md:order-1">
                    <div className="sticky top-0 z-10 flex gap-1 border-b border-token bg-[rgb(var(--surface))] px-4 pt-2" role="tablist" aria-label="Phần sửa">
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
                          className={`-mb-px border-b-[3px] px-4 py-2 text-[15px] font-semibold ${
                            tab === k ? "border-brand-600 text-[rgb(var(--text))]" : "border-transparent text-muted hover:text-[rgb(var(--text))]"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {tab === "edit" ? (
                      <div className="space-y-4 p-4 sm:p-5" role="tabpanel" aria-label="Nội dung slide">
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
            {layout !== "quote" && (
              <Field label="Tiêu đề" value={d.title ?? ""} max={MAX_LEN.title} onChange={(v) => set({ title: v })} onBlur={blur} />
            )}

            {(layout === "cover" || layout === "section") && (
              <Field
                label={layout === "cover" ? "Mô tả ngắn" : "Câu dẫn"}
                value={d.subtitle ?? ""}
                max={MAX_LEN.subtitle}
                multiline
                onChange={(v) => set({ subtitle: v })}
                onBlur={blur}
              />
            )}
            {layout === "cover" && (
              <Field
                label="Giảng viên và lớp"
                value={d.byline ?? ""}
                max={MAX_LEN.byline}
                placeholder="Giảng viên: Nguyễn Văn A · Lớp K66"
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
                {(d.bullets as string[]).map((b, i) => (
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

            {layout === "compare" && (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-1">
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

            {layout === "quote" && (
              <>
                <Field label="Câu trích dẫn" value={d.quote ?? ""} max={MAX_LEN.quote} multiline onChange={(v) => set({ quote: v })} onBlur={blur} />
                <Field label="Nguồn hoặc thông điệp" value={d.source ?? ""} max={MAX_LEN.source} onChange={(v) => set({ source: v })} onBlur={blur} />
              </>
            )}

            {/* Chỉ bốn bố cục có chỗ trống cho hoa văn; Chữ và hình đã có ảnh thì không. */}
            {motifSlot(preview) && (
              <SlideMotifField
                value={savedMotif}
                effective={effectiveMotif?.motif ?? null}
                inherited={inheritedMotif?.motif ?? null}
                themeId={themeId}
                onChange={setMotif}
              />
            )}
          </div>
                      </div>
                    ) : (
                      <div className="max-w-[640px] p-4 sm:p-5" role="tabpanel" aria-label="Nhờ AI sửa slide">
                        <AiEditBar
                          deckId={deckId}
                          slideId={slideId}
                          config={preview}
                          themeId={themeId}
                          onApply={(p, action) => {
                            // Làm mới các ô nhập theo đề xuất (cùng bố cục); đổi loại slide thì trình soạn tự đổi theo.
                            if (p.type === "content") setD(padForEditing(layout, p.config));
                            onApplyProposal(p, action);
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
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
