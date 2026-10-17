"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, Check, GripVertical, Loader2, Plus } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { estimateGenerationTokens } from "@/lib/limioLiveGenerate";
import {
  DURATIONS,
  newOutlineId,
  outlineBlockingProblems,
  outlineStats,
  outlineWarnings,
  slideRange,
  type Outline,
  type OutlineKind,
  type OutlineSlide,
} from "@/lib/limioLiveOutline";
import { OUTLINE_KIND_LABEL, OUTLINE_KIND_ORDER, changeKind, glyphKey, kindGroupOf, rowSubtitle } from "@/lib/limioLiveOutlineUi";
import OutlineGlyph from "./OutlineGlyph";
import SlideDialog from "./SlideDialog";

interface Loaded {
  title: string;
  sourceName: string | null;
  minutes: number;
  outline: Outline;
  confirmedAt: string | null;
  sourceChars: number;
  slideCount: number;
  sync: SyncInfo | null;
}

interface SyncInfo {
  rewrite: number;
  add: number;
  remove: number;
  keep: number;
  noop: boolean;
}

const GEN_ERROR: Record<string, string> = {
  openai_not_configured: "Hệ thống AI chưa được cấu hình. Vui lòng báo quản trị viên.",
  global_token_cap: "Hệ thống AI đang quá tải hôm nay. Vui lòng thử lại sau.",
  daily_token_cap: "Bạn đã dùng hết hạn mức AI hôm nay. Chưa có slide nào được tạo; hãy thử lại vào ngày mai.",
  monthly_token_cap: "Bạn đã dùng hết hạn mức AI của tháng này. Chưa có slide nào được tạo.",
  outline_not_confirmed: "Dàn ý chưa được xác nhận.",
  deck_has_slides: "Bài giảng này đã có slide.",
};

type SaveState = "saved" | "dirty" | "saving" | "error";

export default function OutlineEditor({ deckId }: { deckId: string }) {
  const url = apiUrl(`/api/instructor/limio-live/decks/${deckId}/outline`);
  const [data, setData] = useState<Loaded | null>(null);
  const [outline, setOutline] = useState<Outline>({ title: "", slides: [] });
  const [minutes, setMinutes] = useState(30);
  const [save, setSave] = useState<SaveState>("saved");
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [syncInfo, setSyncInfo] = useState<SyncInfo | null>(null);
  const [slideCount, setSlideCount] = useState(0);
  const [confirmErr, setConfirmErr] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [gen, setGen] = useState<
    | { state: "idle" }
    | { state: "running"; done: number; total: number }
    | { state: "done"; slideCount: number; fallbackCount: number; sync?: { regenerated: number; created: number; removed: number; kept: number } }
    | { state: "error"; message: string }
  >({ state: "idle" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ outline, minutes });
  latest.current = { outline, minutes };

  useEffect(() => {
    (async () => {
      const r = await fetch(url);
      if (!r.ok) return setLoadErr("Không tải được dàn ý.");
      const j = (await r.json()) as Loaded;
      setData(j);
      setOutline(j.outline);
      setMinutes(j.minutes);
      setConfirmedAt(j.confirmedAt);
      setReviewed(!!j.confirmedAt);
      setSyncInfo(j.sync);
      setSlideCount(j.slideCount);
    })().catch(() => setLoadErr("Không tải được dàn ý."));
  }, [url]);

  const flush = useCallback(async () => {
    setSave("saving");
    try {
      const r = await fetch(url, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outline: latest.current.outline, minutes: latest.current.minutes }),
      });
      setSave(r.ok ? "saved" : "error");
      if (r.ok) {
        const j = (await r.json().catch(() => null)) as { sync?: SyncInfo | null; slideCount?: number } | null;
        if (j) {
          setSyncInfo(j.sync ?? null);
          setSlideCount(j.slideCount ?? 0);
        }
      }
    } catch {
      setSave("error");
    }
  }, [url]);

  // Mọi thay đổi huỷ xác nhận cũ (máy chủ cũng làm vậy) và tự lưu sau khi ngừng gõ.
  const change = useCallback(
    (next: Outline, nextMinutes = latest.current.minutes) => {
      setOutline(next);
      setMinutes(nextMinutes);
      latest.current = { outline: next, minutes: nextMinutes };
      setConfirmedAt(null);
      setReviewed(false);
      setConfirmErr(null);
      setSave("dirty");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 800);
    },
    [flush],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const stats = useMemo(() => outlineStats(outline), [outline]);
  const range = slideRange(minutes);
  const warnings = useMemo(() => outlineWarnings(outline, minutes), [outline, minutes]);
  const blocking = useMemo(() => outlineBlockingProblems(outline), [outline]);

  const patch = (id: string, p: Partial<OutlineSlide>) =>
    change({ ...outline, slides: outline.slides.map((s) => (s.id === id ? { ...s, ...p } : s)) });
  const remove = (id: string) => change({ ...outline, slides: outline.slides.filter((s) => s.id !== id) });
  // Thêm sau slide đang sửa (hoặc cuối bài) rồi mở ngay cửa sổ sửa slide mới.
  const add = (kind: OutlineKind) => {
    const at = editingId ? outline.slides.findIndex((x) => x.id === editingId) : -1;
    const ns: OutlineSlide = { id: newOutlineId(), kind, layout: kind === "content" ? "image" : null, title: "", points: kind === "content" ? [""] : [] };
    const slides = [...outline.slides];
    slides.splice(at >= 0 ? at + 1 : slides.length, 0, ns);
    change({ ...outline, slides });
    setAddOpen(false);
    setEditingId(ns.id);
  };
  const setKind = (s: OutlineSlide, kind: OutlineKind) => patch(s.id, changeKind(s, kind));
  const editingIndex = editingId ? outline.slides.findIndex((x) => x.id === editingId) : -1;
  const editing = editingIndex >= 0 ? outline.slides[editingIndex]! : null;

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = outline.slides.findIndex((s) => s.id === e.active.id);
    const to = outline.slides.findIndex((s) => s.id === e.over!.id);
    if (from >= 0 && to >= 0) change({ ...outline, slides: arrayMove(outline.slides, from, to) });
  };

  const confirm = async () => {
    setConfirming(true);
    setConfirmErr(null);
    if (timer.current) clearTimeout(timer.current);
    try {
      const r = await fetch(url, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outline, minutes, confirm: true }),
      });
      const j = (await r.json().catch(() => null)) as { confirmedAt?: string; details?: string[] } | null;
      if (!r.ok) {
        setConfirmErr(Array.isArray(j?.details) ? j!.details!.join(" ") : "Không xác nhận được dàn ý.");
        return;
      }
      setConfirmedAt(j?.confirmedAt ?? new Date().toISOString());
      setSave("saved");
    } finally {
      setConfirming(false);
    }
  };

  const generate = async (mode?: "sync") => {
    setGen({ state: "running", done: 0, total: mode === "sync" && syncInfo ? syncInfo.rewrite + syncInfo.add : outline.slides.length });
    try {
      const res = await fetch(`${url}/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(mode ? { mode } : {}),
      });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        return setGen({ state: "error", message: GEN_ERROR[j?.error ?? ""] ?? "Không tạo được slide. Vui lòng thử lại." });
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let finished = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line) as { type: string; done?: number; total?: number; slideCount?: number; fallbackCount?: number; error?: string; regenerated?: number; created?: number; removed?: number; kept?: number };
          if (ev.type === "progress") setGen({ state: "running", done: ev.done ?? 0, total: ev.total ?? 0 });
          else if (ev.type === "done") {
            finished = true;
            setGen({
              state: "done",
              slideCount: ev.slideCount ?? 0,
              fallbackCount: ev.fallbackCount ?? 0,
              ...(ev.regenerated !== undefined ? { sync: { regenerated: ev.regenerated, created: ev.created ?? 0, removed: ev.removed ?? 0, kept: ev.kept ?? 0 } } : {}),
            });
          } else if (ev.type === "error") {
            finished = true;
            setGen({ state: "error", message: GEN_ERROR[ev.error ?? ""] ?? "Không tạo được slide. Vui lòng thử lại." });
          }
        }
      }
      if (!finished) setGen({ state: "error", message: "Kết nối bị gián đoạn. Hãy mở danh sách bài giảng để kiểm tra bài đã có slide chưa." });
    } catch {
      setGen({ state: "error", message: "Mất kết nối. Vui lòng kiểm tra mạng rồi thử lại." });
    }
  };

  if (loadErr) return <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{loadErr}</p>;
  if (!data) return <p className="text-sm text-muted">Đang tải dàn ý...</p>;

  const saveLabel =
    save === "saving" ? "Đang lưu..." : save === "dirty" ? "Chưa lưu" : save === "error" ? "Lưu lỗi, thử lại" : "Đã lưu";

  return (
    <main className="mx-auto max-w-4xl space-y-6 pb-24">
      <div className="border-b border-token pb-5">
        <a href="/instructor/limio-live" className="text-sm text-muted hover:underline">
          Limio-Live
        </a>
        <h1 className="mt-1 text-2xl font-bold">Dàn ý bài giảng</h1>
        <p className="mt-1 text-sm text-muted">
          {data.title}
          {data.sourceName ? ` · từ tài liệu “${data.sourceName}”` : ""}
        </p>
        <p className="mt-2 text-sm text-muted">
          Bấm vào một slide trong danh sách để sửa loại slide, bố cục và nội dung. Sửa dàn ý không tốn lượt AI. Khi dàn ý ổn,
          xác nhận ở cuối trang để chuyển sang bước tạo slide.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-[rgb(var(--surface-muted))] px-4 py-3 text-sm">
        <span>
          <b>{stats.total}</b> slide ({stats.content} nội dung, {stats.interactive} tương tác)
        </span>
        <label className="flex items-center gap-2">
          Buổi giảng
          <select
            className="input py-1 text-sm"
            value={minutes}
            onChange={(e) => change(outline, Number(e.target.value))}
            aria-label="Thời lượng buổi giảng"
          >
            {DURATIONS.map((d) => (
              <option key={d.minutes} value={d.minutes}>
                {d.minutes} phút
              </option>
            ))}
          </select>
        </label>
        <span className="text-muted">
          Gợi ý {range.min} đến {range.max} slide
        </span>
        <span
          className={`ml-auto flex items-center gap-1.5 ${save === "error" ? "text-red-700" : "text-muted"}`}
          role="status"
        >
          {save === "saving" && <Loader2 size={14} className="animate-spin" />}
          {save === "saved" && <Check size={14} />}
          {saveLabel}
        </span>
      </div>

      {warnings.length > 0 && (
        <ul className="space-y-1.5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {warnings.map((w) => (
            <li key={w} className="flex items-start gap-2">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              {w}
            </li>
          ))}
        </ul>
      )}

      <section className="rounded-2xl border border-token bg-[rgb(var(--surface))] p-3 sm:p-4" aria-labelledby="outline-list-h">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 px-1">
          <h2 id="outline-list-h" className="text-base font-semibold">
            Danh sách slide
          </h2>
          <span className="text-[13px] text-faint">Bấm vào một slide để sửa · kéo ⋮⋮ để đổi thứ tự</span>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={outline.slides.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <ol className="space-y-1.5">
              {outline.slides.map((s, i) => (
                <Row key={s.id} s={s} index={i} onOpen={() => setEditingId(s.id)} />
              ))}
            </ol>
          </SortableContext>
        </DndContext>

        <div className="mt-3 px-1">
          <button type="button" className="btn-secondary flex items-center gap-1.5 text-sm" aria-expanded={addOpen} onClick={() => setAddOpen((v) => !v)}>
            <Plus size={14} /> Thêm slide
          </button>
          {addOpen && (
            <div className="mt-2 space-y-1.5 rounded-xl bg-[rgb(var(--surface-muted))] p-3">
              <span className="block text-[13px] font-semibold text-muted">Chọn loại slide mới (thêm vào cuối bài)</span>
              <div role="group" aria-label="Loại slide mới" className="grid gap-1.5 [grid-template-columns:repeat(auto-fill,minmax(88px,1fr))]">
                {OUTLINE_KIND_ORDER.map((k) => (
                  <button
                    key={k}
                    type="button"
                    title={kindGroupOf(k)}
                    className="grid justify-items-center gap-0.5 rounded-[10px] border border-token bg-[rgb(var(--surface))] px-1 pb-1 pt-1.5 text-[12.5px] leading-tight text-muted hover:bg-[rgb(var(--surface-muted))]"
                    onClick={() => add(k)}
                  >
                    <OutlineGlyph k={k} className="h-[30px] w-full" />
                    <span>{OUTLINE_KIND_LABEL[k]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {editing && (
        <SlideDialog
          slide={editing}
          index={editingIndex}
          total={outline.slides.length}
          onPatch={(p) => patch(editing.id, p)}
          onKind={(k) => setKind(editing, k)}
          onRemove={() => remove(editing.id)}
          onGoto={(d) => setEditingId(outline.slides[editingIndex + d]?.id ?? editing.id)}
          onClose={() => setEditingId(null)}
        />
      )}

      <section className="space-y-3 rounded-2xl border-2 border-token p-5" aria-labelledby="confirm-h">
        <h2 id="confirm-h" className="text-lg font-semibold">
          Xác nhận dàn ý
        </h2>
        {blocking.length > 0 && (
          <ul className="space-y-1 text-sm text-red-800">
            {blocking.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        )}
        {gen.state === "done" ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
              <Check size={16} />
              {gen.sync
                ? `Đã cập nhật: viết lại ${gen.sync.regenerated} slide, thêm ${gen.sync.created}, xoá ${gen.sync.removed}, giữ nguyên ${gen.sync.kept} slide bạn đã sửa hoặc tự thêm.`
                : `Đã tạo ${gen.slideCount} slide từ dàn ý.`}
            </p>
            {gen.state === "done" && gen.fallbackCount > 0 && (
              <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                {gen.fallbackCount} slide AI chưa viết được nên được dựng thẳng từ dàn ý (hoặc để khung trống với câu hỏi
                quiz và bình chọn). Hãy xem lại các slide đó.
              </p>
            )}
            <a href={`/instructor/limio-live/${deckId}`} className="btn-primary inline-flex">
              Mở bài giảng để xem và chỉnh slide
            </a>
          </div>
        ) : confirmedAt ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
              <Check size={16} /> Bạn đã xác nhận dàn ý này. Sửa dàn ý sẽ huỷ xác nhận.
            </p>
            {slideCount > 0 && syncInfo && gen.state !== "running" && (
              <div className="space-y-3">
                <p className="text-sm text-muted">
                  Bài giảng đã có {slideCount} slide.{" "}
                  {syncInfo.noop ? (
                    <b>Các slide đã khớp với dàn ý.</b>
                  ) : (
                    <>
                      Cập nhật theo dàn ý sẽ viết lại <b>{syncInfo.rewrite}</b> slide AI đã tạo và bạn chưa sửa, thêm{" "}
                      <b>{syncInfo.add}</b> slide cho dòng mới, xoá <b>{syncInfo.remove}</b> slide của dòng đã bỏ. Giữ nguyên{" "}
                      <b>{syncInfo.keep}</b> slide bạn đã sửa hoặc tự thêm.
                    </>
                  )}
                </p>
                {gen.state === "error" && <p className="text-sm font-medium text-red-800">{gen.message}</p>}
                <div className="flex flex-wrap gap-2">
                  {!syncInfo.noop && (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Cập nhật slide theo dàn ý?\n\n• Viết lại ${syncInfo.rewrite} slide chưa sửa (nội dung cũ của các slide này sẽ bị thay)\n• Thêm ${syncInfo.add} slide\n• Xoá ${syncInfo.remove} slide\n• Giữ nguyên ${syncInfo.keep} slide bạn đã sửa hoặc tự thêm\n\nDự kiến dùng khoảng ${formatTokens(estimateGenerationTokens({ sourceChars: data.sourceChars, slideCount: syncInfo.rewrite + syncInfo.add }).total)} token AI.`,
                          )
                        )
                          void generate("sync");
                      }}
                    >
                      Cập nhật slide theo dàn ý
                    </button>
                  )}
                  <a href={`/instructor/limio-live/${deckId}`} className="btn-secondary inline-flex">
                    Mở bài giảng
                  </a>
                </div>
              </div>
            )}
            {gen.state === "running" ? (
              <div className="space-y-2" role="status">
                <div className="h-2.5 overflow-hidden rounded-full bg-black/10">
                  <div
                    className="h-full rounded-full bg-brand-600 transition-all"
                    style={{ width: `${gen.total ? Math.round((gen.done / gen.total) * 100) : 0}%` }}
                  />
                </div>
                <p className="flex items-center gap-2 text-sm text-muted">
                  <Loader2 size={14} className="animate-spin" /> Đã viết {gen.done}/{gen.total} slide. Vui lòng không đóng trang.
                </p>
              </div>
            ) : slideCount > 0 ? null : (
              <>
                <p className="text-sm text-muted">
                  AI sẽ viết nội dung và ghi chú giảng cho {outline.slides.length} slide theo đúng dàn ý. Dự kiến dùng khoảng{" "}
                  <b>{formatTokens(estimateGenerationTokens({ sourceChars: data.sourceChars, slideCount: outline.slides.length }).total)}</b>{" "}
                  token AI.
                </p>
                {gen.state === "error" && <p className="text-sm font-medium text-red-800">{gen.message}</p>}
                <button type="button" className="btn-primary flex items-center gap-2" onClick={() => void generate()}>
                  Tạo slide từ dàn ý
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
                disabled={blocking.length > 0}
              />
              Tôi đã xem lại từng slide trong dàn ý và đồng ý với thứ tự, tiêu đề, ý chính, bố cục.
            </label>
            {confirmErr && <p className="text-sm font-medium text-red-800">{confirmErr}</p>}
            <button
              type="button"
              className="btn-primary flex items-center gap-2"
              disabled={!reviewed || blocking.length > 0 || confirming || save === "saving"}
              onClick={confirm}
            >
              {confirming && <Loader2 size={16} className="animate-spin" />}
              Xác nhận dàn ý
            </button>
          </>
        )}
      </section>
    </main>
  );
}

function formatTokens(n: number): string {
  return n >= 1000 ? `${Math.round(n / 100) / 10} nghìn`.replace(".", ",") : String(n);
}

function Row({ s, index, onOpen }: { s: OutlineSlide; index: number; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.id });
  const interactive = s.kind !== "content";

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
      className={`flex items-center gap-1.5 rounded-xl border border-transparent px-1.5 py-1.5 hover:bg-[rgb(var(--surface-muted))] ${interactive ? "bg-indigo-50/60 dark:bg-indigo-950/20" : ""}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none p-1 text-faint active:cursor-grabbing"
        aria-label={`Kéo để đổi thứ tự slide ${index + 1}`}
      >
        <GripVertical size={18} />
      </button>
      <span className="w-6 text-sm font-bold tabular-nums text-muted">{index + 1}</span>
      <button type="button" className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-0.5 text-left" onClick={onOpen} aria-label={`Sửa slide ${index + 1}: ${s.title || "chưa có tiêu đề"}`}>
        <OutlineGlyph k={glyphKey(s)} className="h-[30px] w-[46px] shrink-0 text-muted" />
        <span className="grid min-w-0 flex-1 leading-snug">
          <b className={`truncate text-[15px] ${s.title.trim() ? "" : "font-medium text-red-700"}`}>
            {s.title.trim() || (interactive ? "Chưa có câu hỏi" : "Chưa có tiêu đề")}
          </b>
          <small className="truncate text-[13px] text-muted">{rowSubtitle(s)}</small>
        </span>
        <span className="hidden shrink-0 rounded-lg border border-token bg-[rgb(var(--surface))] px-3 py-1 text-[13px] font-semibold text-brand-700 sm:inline">Sửa</span>
      </button>
    </li>
  );
}
