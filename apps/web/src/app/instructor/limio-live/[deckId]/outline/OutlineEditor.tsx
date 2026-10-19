"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronLeft, FileText, LayoutTemplate, Loader2, PenLine, Plus, Sparkles } from "lucide-react";
import { outlineStory } from "@/lib/limioLiveOutlineCard";
import { apiUrl } from "@/lib/apiUrl";
import { estimateGenerationTokens } from "@/lib/limioLiveGenerate";
import {
  DURATIONS,
  OUTLINE_LAYOUTS,
  isFullStructure,
  isImportedRow,
  isTopicSource,
  isClosingSlide,
  layoutAllowedFor,
  outlineBlockingProblems,
  outlineStats,
  outlineWarnings,
  slideRange,
  slideStructureRole,
  type Outline,
  type OutlineKind,
  type OutlineSlide,
  type DeckSourceKind,
  type WebSourceRef,
} from "@/lib/limioLiveOutline";
import { TopicSourceNotice } from "../../TopicSourceNotice";
import {
  addContentPart,
  addSlideToPart,
  changeKind,
  moveSlide,
  patchSlide,
  removeSlide,
  renamePart,
  restoreSlide,
  type RemovedSlide,
} from "@/lib/limioLiveOutlineUi";
import OutlineFlow from "./OutlineFlow";
import SlideDialog from "./SlideDialog";
import GenerationGrid from "./GenerationGrid";
import { ThemeBox } from "./OutlineSide";

interface Loaded {
  title: string;
  theme?: string;
  sourceName: string | null;
  sourceKind: DeckSourceKind;
  webRefs: WebSourceRef[] | null;
  sourceFigureKeys?: string[];
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
  const [outline, setOutline] = useState<Outline>({ title: "", slides: [], parts: [] });
  const [minutes, setMinutes] = useState(30);
  const [save, setSave] = useState<SaveState>("saved");
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [syncInfo, setSyncInfo] = useState<SyncInfo | null>(null);
  const [slideCount, setSlideCount] = useState(0);
  const [theme, setTheme] = useState("brand");
  const [confirmErr, setConfirmErr] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  // Xoá không hỏi lại; thông báo có nút Hoàn tác trong vài giây.
  const [undo, setUndo] = useState<RemovedSlide | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [gen, setGen] = useState<
    | { state: "idle" }
    | { state: "running"; done: number; total: number; writing: string[] | null; doneIds: string[] }
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
      setTheme(j.theme ?? "brand");
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
      if (undoTimer.current) clearTimeout(undoTimer.current);
    },
    [],
  );

  const stats = useMemo(() => outlineStats(outline), [outline]);
  const range = slideRange(minutes);
  const warnings = useMemo(
    () => outlineWarnings(outline, minutes, { sourceKind: data?.sourceKind, sourceFigureKeys: data?.sourceFigureKeys }),
    [outline, minutes, data?.sourceKind, data?.sourceFigureKeys],
  );
  const blocking = useMemo(() => outlineBlockingProblems(outline), [outline]);

  const patch = (id: string, p: Partial<OutlineSlide>) => change(patchSlide(outline, id, p));
  const remove = (id: string) => {
    const r = removeSlide(outline, id);
    if (!r.removed) return;
    change(r.outline);
    setUndo(r.removed);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 6000);
  };
  const restore = () => {
    if (!undo) return;
    change(restoreSlide(latest.current.outline, undo));
    setUndo(null);
  };
  // Thêm vào cuối một phần rồi mở ngay cửa sổ sửa slide mới (loại slide và bố cục chọn trong đó).
  const addToPart = (partId: string) => {
    const r = addSlideToPart(outline, partId);
    change(r.outline);
    setEditingId(r.id);
  };
  const addPart = () => {
    const r = addContentPart(outline, isFullStructure(minutes));
    change(r.outline);
    setRenamingId(r.partId);
  };
  const setKind = (s: OutlineSlide, kind: OutlineKind) => patch(s.id, changeKind(s, kind));
  const editingIndex = editingId ? outline.slides.findIndex((x) => x.id === editingId) : -1;
  const editing = editingIndex >= 0 ? outline.slides[editingIndex]! : null;

  // Một nút "Tạo n slide" gộp xác nhận dàn ý và tạo (O5): xác nhận trước, thành công mới tạo.
  const confirm = async (): Promise<boolean> => {
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
        return false;
      }
      setConfirmedAt(j?.confirmedAt ?? new Date().toISOString());
      setSave("saved");
      return true;
    } finally {
      setConfirming(false);
    }
  };

  const createSlides = async (mode?: "sync") => {
    if (await confirm()) await generate(mode);
  };

  const generate = async (mode?: "sync") => {
    setGen({ state: "running", done: 0, total: mode === "sync" && syncInfo ? syncInfo.rewrite + syncInfo.add : outline.slides.length, writing: null, doneIds: [] });
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
          const ev = JSON.parse(line) as { type: string; id?: string; ids?: string[]; done?: number; total?: number; slideCount?: number; fallbackCount?: number; error?: string; regenerated?: number; created?: number; removed?: number; kept?: number };
          if (ev.type === "start") setGen((g) => (g.state === "running" ? { ...g, total: ev.total ?? g.total, writing: Array.isArray(ev.ids) ? ev.ids : null } : g));
          else if (ev.type === "slide") setGen((g) => (g.state === "running" && ev.id ? { ...g, doneIds: [...g.doneIds, ev.id] } : g));
          else if (ev.type === "progress") setGen((g) => (g.state === "running" ? { ...g, done: ev.done ?? 0, total: ev.total ?? 0 } : g));
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

  // Bài nhập từ PowerPoint: dòng lấy nguyên từ slide gốc dựng không qua AI; AI chỉ viết các dòng còn lại.
  const importedRows = outline.slides.filter(isImportedRow).length;
  const aiRows = outline.slides.length - importedRows;

  const inRange = stats.total >= range.min && stats.total <= range.max;
  const story = outlineStory(outline, { imported: importedRows });
  const running = gen.state === "running";
  const aiTokens = formatTokens(estimateGenerationTokens({ sourceChars: data.sourceChars, slideCount: aiRows }).total);

  return (
    <main className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-3">
        <a href="/instructor/limio-live" className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-[rgb(var(--text))]">
          <ChevronLeft size={16} /> Limio-Live
        </a>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h1 className="text-2xl font-bold">Dàn ý bài giảng</h1>
          {data.sourceName && (
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[rgb(var(--surface-muted))] px-3 py-1 text-[13px] font-medium text-muted">
              {isTopicSource(data.sourceKind) ? <PenLine size={14} className="shrink-0" /> : <FileText size={14} className="shrink-0" />}
              <span className="truncate">{data.sourceName}</span>
            </span>
          )}
        </div>
        <p className="text-[15px] font-semibold leading-snug">{data.title}</p>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Bấm vào một slide để sửa loại slide, bố cục và nội dung. Sửa dàn ý không tốn lượt AI.{" "}
          {importedRows > 0
            ? "Slide lấy từ file gốc giữ nguyên chữ, hình và ghi chú giảng. Khi dàn ý ổn, bấm Tạo ở cuối trang."
            : "Khi dàn ý ổn, bấm Tạo ở cuối trang để AI viết slide."}
        </p>
        <TopicSourceNotice sourceKind={data.sourceKind} webRefs={data.webRefs} />
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <aside className="order-1 grid gap-4 lg:sticky lg:top-4 lg:order-2 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto" aria-label="Thông tin bài giảng">
          <div className="grid gap-4 rounded-2xl border border-token bg-[rgb(var(--surface))] p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="flex items-baseline gap-1.5">
                <b className="text-3xl font-bold leading-none tabular-nums">{stats.total}</b>
                <span className="text-sm font-medium text-muted">slide</span>
              </span>
              <span className="rounded-full bg-[rgb(var(--surface-muted))] px-2.5 py-1 text-[13px] font-medium text-muted">{stats.content} nội dung</span>
              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[13px] font-medium text-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-200">{stats.interactive} tương tác</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1">
                <span className="whitespace-nowrap text-[11px] font-bold uppercase tracking-wide text-faint">Buổi giảng</span>
                <select className="input h-9 w-full py-1 text-sm font-medium" value={minutes} onChange={(e) => change(outline, Number(e.target.value))} aria-label="Thời lượng buổi giảng">
                  {DURATIONS.map((d) => (
                    <option key={d.minutes} value={d.minutes}>
                      {d.minutes} phút
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-1">
                <span className="whitespace-nowrap text-[11px] font-bold uppercase tracking-wide text-faint">Gợi ý</span>
                <span
                  className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-sm font-semibold ${
                    inRange ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200" : "bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
                  }`}
                  title={inRange ? "Số slide nằm trong mức gợi ý" : "Số slide ngoài mức gợi ý cho thời lượng này"}
                >
                  {inRange ? <Check size={14} /> : <AlertTriangle size={14} />} {range.min} đến {range.max}
                </span>
              </div>
            </div>
            <span className={`flex items-center gap-1.5 text-sm ${save === "error" ? "font-semibold text-red-700" : "text-muted"}`} role="status">
              {save === "saving" && <Loader2 size={14} className="animate-spin" />}
              {save === "saved" && <Check size={14} className="text-emerald-600" />}
              {saveLabel}
            </span>
          </div>

          <ThemeBox deckId={deckId} title={data.title} outline={outline} theme={theme} onTheme={setTheme} />

          <section className="rounded-2xl border border-token bg-[rgb(var(--surface))] p-4" aria-label="Mạch bài">
            <h2 className="mb-1.5 text-base font-semibold">Mạch bài</h2>
            <p className="text-[14.5px] leading-relaxed text-muted">{story}</p>
          </section>

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
        </aside>

        <div className="order-2 min-w-0 lg:order-1">
          {running ? (
            <section aria-labelledby="gen-h" className="space-y-3">
              <h2 id="gen-h" className="text-base font-semibold">
                Đang tạo slide
              </h2>
              <GenerationGrid slides={outline.slides} done={new Set((gen as { doneIds: string[] }).doneIds)} writing={(gen as { writing: string[] | null }).writing ? new Set((gen as { writing: string[] }).writing) : null} />
            </section>
          ) : (
            <section className="rounded-2xl border border-token bg-[rgb(var(--surface))] p-3 sm:p-4" aria-labelledby="outline-list-h">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 px-1">
                <h2 id="outline-list-h" className="text-base font-semibold">
                  Danh sách slide
                </h2>
                <span className="text-[13px] text-faint">Bấm vào một slide để sửa · kéo ⋮⋮ để đổi thứ tự hoặc chuyển phần</span>
              </div>
              <OutlineFlow
                outline={outline}
                onOpen={setEditingId}
                onRemove={remove}
                onMove={(id, target) => change(moveSlide(outline, id, target))}
                onAddSlide={addToPart}
                onRename={(partId, name) => change(renamePart(outline, partId, name))}
                renamingId={renamingId}
                setRenamingId={setRenamingId}
              />
              <div className="mt-3 pl-8">
                <button type="button" className="btn-secondary flex items-center gap-1.5 text-sm" onClick={addPart}>
                  <Plus size={14} /> Thêm phần nội dung
                </button>
              </div>
            </section>
          )}
        </div>
      </div>

      {editing && (
        <SlideDialog
          slide={editing}
          index={editingIndex}
          total={outline.slides.length}
          auto={slideStructureRole(outline, editing)}
          onPatch={(p) => patch(editing.id, p)}
          onKind={(k) => setKind(editing, k)}
          onRemove={() => remove(editing.id)}
          onGoto={(d) => setEditingId(outline.slides[editingIndex + d]?.id ?? editing.id)}
          onClose={() => setEditingId(null)}
          layouts={OUTLINE_LAYOUTS.filter(
            // "Nhóm" chỉ dành cho slide lấy từ file PowerPoint (dựng thẳng, không qua AI); AI không viết bố cục này.
            (l) => (l !== "groups" || editing.layout === "groups" || isImportedRow(editing)) && (layoutAllowedFor(data.sourceKind, l) || (l === "quote" && isClosingSlide(outline, editing))),
          )}
        />
      )}

      {/* Thanh dính đáy (O5): một nút duy nhất gộp Xác nhận dàn ý và Tạo slide, luôn trong tầm mắt. */}
      <div className="sticky bottom-0 z-30 -mx-4 border-t border-token bg-[rgb(var(--surface))]/95 px-4 py-3 backdrop-blur" role="region" aria-label="Tạo slide">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {running ? (
            <div className="flex w-full max-w-xl items-center gap-3" role="status">
              <Loader2 size={16} className="shrink-0 animate-spin" />
              <b className="whitespace-nowrap text-[15px]">
                Đang tạo slide {Math.min((gen as { done: number }).done + 1, (gen as { total: number }).total || 1)} trên {(gen as { total: number }).total}
              </b>
              <div className="h-2 min-w-[120px] flex-1 overflow-hidden rounded-full bg-black/10">
                <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${(gen as { total: number }).total ? Math.round(((gen as { done: number }).done / (gen as { total: number }).total) * 100) : 0}%` }} />
              </div>
              <span className="hidden text-[13px] text-muted sm:inline">Vui lòng không đóng trang.</span>
            </div>
          ) : gen.state === "done" ? (
            <>
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-900 dark:text-emerald-200">
                <Check size={16} />
                {gen.sync
                  ? `Đã cập nhật: viết lại ${gen.sync.regenerated} slide, thêm ${gen.sync.created}, xoá ${gen.sync.removed}, giữ nguyên ${gen.sync.kept}.`
                  : `Đã tạo ${gen.slideCount} slide từ dàn ý.`}
                {gen.fallbackCount > 0 && ` ${gen.fallbackCount} slide AI chưa viết được nên được dựng thẳng từ dàn ý; hãy xem lại.`}
              </p>
              <a href={`/instructor/limio-live/${deckId}`} className="btn-primary inline-flex">
                Mở bài giảng để xem và chỉnh slide
              </a>
            </>
          ) : slideCount > 0 && syncInfo ? (
            <>
              <p className="max-w-xl text-sm text-muted">
                Bài giảng đã có {slideCount} slide.{" "}
                {syncInfo.noop ? (
                  <b>Các slide đã khớp với dàn ý.</b>
                ) : (
                  <>
                    Cập nhật sẽ viết lại <b>{syncInfo.rewrite}</b> slide AI đã tạo và bạn chưa sửa, thêm <b>{syncInfo.add}</b>, xoá <b>{syncInfo.remove}</b>; giữ nguyên <b>{syncInfo.keep}</b> slide bạn đã sửa hoặc tự thêm.
                  </>
                )}
              </p>
              {gen.state === "error" && <p className="text-sm font-medium text-red-800">{gen.message}</p>}
              {confirmErr && <p className="text-sm font-medium text-red-800">{confirmErr}</p>}
              <div className="flex flex-wrap gap-2">
                {!syncInfo.noop && (
                  <button
                    type="button"
                    className="btn-primary flex items-center gap-2"
                    disabled={blocking.length > 0 || confirming || save === "saving"}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Cập nhật slide theo dàn ý?\n\n• Viết lại ${syncInfo.rewrite} slide chưa sửa (nội dung cũ của các slide này sẽ bị thay)\n• Thêm ${syncInfo.add} slide\n• Xoá ${syncInfo.remove} slide\n• Giữ nguyên ${syncInfo.keep} slide bạn đã sửa hoặc tự thêm\n\nDự kiến dùng khoảng ${formatTokens(estimateGenerationTokens({ sourceChars: data.sourceChars, slideCount: syncInfo.rewrite + syncInfo.add }).total)} token AI.`,
                        )
                      )
                        void createSlides("sync");
                    }}
                  >
                    {confirming ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} aria-hidden />} Cập nhật slide theo dàn ý
                  </button>
                )}
                <a href={`/instructor/limio-live/${deckId}`} className="btn-secondary inline-flex">
                  Mở bài giảng
                </a>
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-0.5 text-center text-sm text-muted sm:text-left">
                {blocking.length > 0 ? (
                  blocking.map((b) => (
                    <span key={b} className="font-medium text-red-800">
                      {b}
                    </span>
                  ))
                ) : aiRows === 0 ? (
                  <span>
                    {outline.slides.length} slide được dựng từ slide gốc của file, giữ nguyên chữ, hình và ghi chú giảng. Không dùng AI, không tốn token.
                  </span>
                ) : (
                  <span>
                    AI viết nội dung và ghi chú giảng cho {aiRows} slide theo đúng dàn ý
                    {importedRows > 0 ? `; ${importedRows} slide lấy nguyên từ file gốc` : ""}. Dự kiến dùng khoảng <b>{aiTokens}</b> token AI.
                  </span>
                )}
                {gen.state === "error" && <span className="font-medium text-red-800">{gen.message}</span>}
                {confirmErr && <span className="font-medium text-red-800">{confirmErr}</span>}
              </div>
              <button
                type="button"
                className="btn-primary flex items-center gap-2 px-8 text-base"
                disabled={blocking.length > 0 || confirming || save === "saving"}
                onClick={() => void createSlides()}
              >
                {confirming ? <Loader2 size={16} className="animate-spin" /> : aiRows === 0 ? <LayoutTemplate size={16} aria-hidden /> : <Sparkles size={16} aria-hidden />}
                Tạo {stats.total} slide
              </button>
            </>
          )}
        </div>
      </div>

      {undo && (
        <div role="status" aria-live="polite" className="fixed bottom-20 left-1/2 z-50 flex max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-3 rounded-xl bg-[rgb(var(--text))] px-4 py-2.5 text-sm text-[rgb(var(--surface))] shadow-lg">
          <span>Đã xoá slide {undo.index + 1}.</span>
          <button type="button" className="font-bold text-lime-400 hover:underline dark:text-lime-700" onClick={restore}>
            Hoàn tác
          </button>
        </div>
      )}
    </main>
  );
}

function formatTokens(n: number): string {
  return n >= 1000 ? `${Math.round(n / 100) / 10} nghìn`.replace(".", ",") : String(n);
}
