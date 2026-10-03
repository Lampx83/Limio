"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Globe, Lock, MessageSquarePlus, Pencil, Send, Sparkles, Trash2, X } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import {
  captureAnchor,
  resolveAnnotationRange,
  type CapturedAnchor,
} from "@/lib/annotationAnchor";
import DateTime from "@/components/ui/DateTime";

/**
 * Bôi đen một cụm chữ trong bài → chuột phải → "Viết annotation" / "Hỏi AI".
 *
 * Annotation mặc định riêng tư; tác giả bật "chia sẻ với cả lớp" thì mọi người
 * trong khoá thấy được và reply được. Đoạn đã có annotation được tô nền; bấm
 * vào đoạn tô nền để mở cuộc trao đổi.
 *
 * Tô nền bằng CSS Custom Highlight API (::highlight) chứ không bọc <mark> vào
 * DOM: nội dung bài do React/DOMPurify quản lý, chèn node lạ vào đó sẽ vỡ ở lần
 * render sau. Trình duyệt chưa hỗ trợ thì mọi thứ khác vẫn chạy, chỉ không có
 * nền tô và không bấm vào đoạn cũ được.
 */

interface Reply {
  id: string;
  body: string;
  createdAt: string;
  author: { displayName: string };
  mine: boolean;
}
interface Annotation {
  id: string;
  contentItemId: string;
  quote: string;
  prefix: string;
  suffix: string;
  startOffset: number;
  endOffset: number;
  body: string;
  visibility: "private" | "published";
  createdAt: string;
  author: { displayName: string };
  mine: boolean;
  replies: Reply[];
}

interface MenuState {
  x: number;
  y: number;
  quote: string;
  anchor: CapturedAnchor | null;
  /** Hiện do chạm (mobile) chứ không phải do chuột phải. */
  touch: boolean;
}

type HighlightRegistry = {
  set(name: string, h: unknown): void;
  delete(name: string): void;
};

function highlightRegistry(): HighlightRegistry | null {
  const reg = (CSS as unknown as { highlights?: HighlightRegistry }).highlights;
  const Ctor = (globalThis as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight;
  return reg && Ctor ? reg : null;
}

function makeHighlight(ranges: Range[]): unknown {
  const Ctor = (globalThis as unknown as { Highlight: new (...r: Range[]) => unknown }).Highlight;
  return new Ctor(...ranges);
}

const HL_NAMES = ["annot-private", "annot-shared", "annot-others", "annot-active"] as const;
const MENU_W = 232;
const CARD_W = 380;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(n, hi));
}

const ERROR_TEXT: Record<string, string> = {
  not_enrolled: "Bạn cần ghi danh khoá học để ghi chú.",
  too_many: "Bạn đã đạt số annotation tối đa cho bài này.",
  not_published: "Hãy chia sẻ annotation với cả lớp trước khi trả lời.",
  validation_failed: "Nội dung chưa hợp lệ — kiểm tra lại đoạn chọn và ghi chú.",
  lesson_not_found: "Bài học này hiện chưa mở.",
};

async function api(
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(apiUrl(path), {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, data };
}

function errText(data: Record<string, unknown>): string {
  const code = typeof data.error === "string" ? data.error : "unknown";
  return ERROR_TEXT[code] ?? "Có lỗi xảy ra, thử lại sau.";
}

export default function LessonAnnotations({
  lessonId,
  containerId = "lesson-content",
  canModerate,
  aiEnabled,
}: {
  lessonId: string;
  containerId?: string;
  /** Người dạy khoá: gỡ được annotation/reply công khai của người khác. */
  canModerate: boolean;
  aiEnabled: boolean;
}) {
  const [items, setItems] = useState<Annotation[]>([]);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [composer, setComposer] = useState<{ anchor: CapturedAnchor; x: number; y: number } | null>(null);
  const [thread, setThread] = useState<{ id: string; x: number; y: number } | null>(null);
  const rangesRef = useRef<Map<string, Range>>(new Map());
  const lastPointer = useRef<string>("mouse");
  const menuRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const { ok, data } = await api(`/api/lessons/${lessonId}/annotations`, "GET");
      if (ok) setItems((data.items as Annotation[]) ?? []);
    } catch {
      /* Tính năng phụ: lỗi mạng thì bài vẫn đọc bình thường. */
    }
  }, [lessonId]);

  useEffect(() => {
    void load();
  }, [load]);

  // ---- Tô nền các đoạn đã có annotation ---------------------------------
  const paint = useCallback(() => {
    const reg = highlightRegistry();
    const container = document.getElementById(containerId);
    if (!reg || !container) return;
    const priv: Range[] = [];
    const shared: Range[] = [];
    const others: Range[] = [];
    const map = new Map<string, Range>();
    for (const a of items) {
      const r = resolveAnnotationRange(container, a);
      if (!r) continue; // mồ côi: bài đã sửa mất đoạn này
      map.set(a.id, r);
      if (!a.mine) others.push(r);
      else if (a.visibility === "published") shared.push(r);
      else priv.push(r);
    }
    rangesRef.current = map;
    reg.set("annot-private", makeHighlight(priv));
    reg.set("annot-shared", makeHighlight(shared));
    reg.set("annot-others", makeHighlight(others));
    const active = thread ? map.get(thread.id) : undefined;
    reg.set("annot-active", makeHighlight(active ? [active] : []));
  }, [items, thread, containerId]);

  useEffect(() => {
    paint();
    const container = document.getElementById(containerId);
    if (!container) return;
    // SafeHtml làm sạch HTML SAU khi hydrate nên chữ xuất hiện muộn; bài cũng có
    // thể đổi khi giảng viên sửa. Vẽ lại mỗi khi DOM nội dung đổi (gộp 120ms).
    let t: ReturnType<typeof setTimeout> | undefined;
    const mo = new MutationObserver(() => {
      clearTimeout(t);
      t = setTimeout(paint, 120);
    });
    mo.observe(container, { childList: true, subtree: true, characterData: true });
    return () => {
      clearTimeout(t);
      mo.disconnect();
    };
  }, [paint, containerId]);

  useEffect(() => {
    return () => {
      const reg = highlightRegistry();
      if (reg) for (const n of HL_NAMES) reg.delete(n);
    };
  }, []);

  // ---- Chuột phải trên vùng bôi đen (và thanh nổi cho cảm ứng) ----------
  useEffect(() => {
    const container = () => document.getElementById(containerId);

    function currentSelection(): { range: Range; text: string } | null {
      const sel = window.getSelection();
      const c = container();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !c) return null;
      const range = sel.getRangeAt(0);
      if (!c.contains(range.commonAncestorContainer)) return null;
      const text = sel.toString().trim();
      return text ? { range, text } : null;
    }

    const onContext = (e: MouseEvent) => {
      const s = currentSelection();
      if (!s) return;
      e.preventDefault();
      setThread(null);
      setComposer(null);
      setMenu({
        x: e.clientX,
        y: e.clientY,
        quote: s.text,
        anchor: captureAnchor(s.range),
        touch: false,
      });
    };

    const onPointerDown = (e: PointerEvent) => {
      lastPointer.current = e.pointerType;
    };

    // Cảm ứng không có chuột phải: hiện thanh dưới vùng chọn khi người dùng
    // ngừng kéo tay cầm chọn chữ.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onSelectionChange = () => {
      if (lastPointer.current !== "touch") return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        const s = currentSelection();
        if (!s) {
          setMenu((m) => (m?.touch ? null : m));
          return;
        }
        const rect = s.range.getBoundingClientRect();
        setMenu({
          x: rect.left + rect.width / 2 - MENU_W / 2,
          y: rect.bottom + 14,
          quote: s.text,
          anchor: captureAnchor(s.range),
          touch: true,
        });
      }, 350);
    };

    // Bấm vào đoạn đã tô nền → mở cuộc trao đổi.
    const onClick = (e: MouseEvent) => {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;
      const target = e.target as Element | null;
      if (target?.closest("a,button,input,textarea,select,summary,video,audio,iframe")) return;
      let hit: { id: string; size: number } | null = null;
      for (const [id, range] of rangesRef.current) {
        const rects = Array.from(range.getClientRects());
        const inside = rects.some(
          (r) =>
            e.clientX >= r.left - 1 &&
            e.clientX <= r.right + 1 &&
            e.clientY >= r.top - 1 &&
            e.clientY <= r.bottom + 1,
        );
        if (!inside) continue;
        const size = range.toString().length;
        if (!hit || size < hit.size) hit = { id, size };
      }
      if (hit) {
        setMenu(null);
        setComposer(null);
        setThread({ id: hit.id, x: e.clientX, y: e.clientY });
      }
    };

    const c = container();
    document.addEventListener("contextmenu", onContext);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("selectionchange", onSelectionChange);
    c?.addEventListener("click", onClick);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("contextmenu", onContext);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("selectionchange", onSelectionChange);
      c?.removeEventListener("click", onClick);
    };
  }, [containerId]);

  // Đóng menu khi bấm ra ngoài / cuộn / Esc.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onDown = (e: PointerEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, { passive: true, once: true });
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close);
      window.removeEventListener("resize", close);
    };
  }, [menu]);

  const askAi = () => {
    if (!menu) return;
    window.dispatchEvent(new CustomEvent("limio:ask-ai", { detail: { quote: menu.quote } }));
    setMenu(null);
  };

  const startAnnotate = () => {
    if (!menu?.anchor) return;
    setComposer({ anchor: menu.anchor, x: menu.x, y: menu.y });
    setMenu(null);
  };

  const activeThread = useMemo(
    () => (thread ? items.find((a) => a.id === thread.id) ?? null : null),
    [thread, items],
  );

  return (
    <>
      {menu && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Thao tác với đoạn đã chọn"
          // Giữ nguyên vùng bôi đen khi bấm vào menu.
          onMouseDown={(e) => e.preventDefault()}
          className="fixed z-50 rounded-xl border border-token bg-[rgb(var(--surface))] p-1 shadow-card-hover animate-fade-in-up"
          style={{
            width: MENU_W,
            left: clamp(menu.x, 8, window.innerWidth - MENU_W - 8),
            top: clamp(menu.y, 8, window.innerHeight - 110),
          }}
        >
          <button
            role="menuitem"
            type="button"
            disabled={!menu.anchor}
            onClick={startAnnotate}
            className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-[rgb(var(--surface-muted))] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <MessageSquarePlus size={16} className="mt-0.5 shrink-0 text-brand-600" />
            <span>
              <span className="block font-medium">Viết annotation</span>
              {!menu.anchor && (
                <span className="block text-xs text-faint">
                  Hãy chọn trong cùng một đoạn nội dung
                </span>
              )}
            </span>
          </button>
          {aiEnabled && (
            <button
              role="menuitem"
              type="button"
              onClick={askAi}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-[rgb(var(--surface-muted))]"
            >
              <Sparkles size={16} className="shrink-0 text-brand-600" />
              <span className="font-medium">Hỏi AI về đoạn này</span>
            </button>
          )}
        </div>
      )}

      {composer && (
        <Composer
          lessonId={lessonId}
          anchor={composer.anchor}
          x={composer.x}
          y={composer.y}
          onClose={() => setComposer(null)}
          onSaved={async () => {
            setComposer(null);
            window.getSelection()?.removeAllRanges();
            await load();
          }}
        />
      )}

      {thread && activeThread && (
        <Thread
          key={activeThread.id}
          lessonId={lessonId}
          annotation={activeThread}
          x={thread.x}
          y={thread.y}
          canModerate={canModerate}
          onClose={() => setThread(null)}
          onChanged={load}
          onDeleted={async () => {
            setThread(null);
            await load();
          }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

/** Thẻ nổi: bottom sheet trên màn hẹp, thẻ cạnh con trỏ từ `sm` trở lên. */
function FloatingCard({
  x,
  y,
  label,
  onClose,
  children,
}: {
  x: number;
  y: number;
  label: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const narrow = typeof window !== "undefined" && window.innerWidth < 640;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKey);
    // Trì hoãn một nhịp để cú bấm vừa mở thẻ không đóng nó ngay.
    const t = setTimeout(() => document.addEventListener("pointerdown", onDown, true), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [onClose]);

  const style = narrow
    ? undefined
    : {
        width: CARD_W,
        left: clamp(x + 8, 8, window.innerWidth - CARD_W - 8),
        top: clamp(y + 12, 8, Math.max(8, window.innerHeight - 420)),
      };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      style={style}
      className={
        narrow
          ? "fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl border border-token bg-[rgb(var(--surface))] p-4 shadow-card-hover animate-fade-in-up"
          : "fixed z-50 max-h-[70vh] overflow-y-auto rounded-2xl border border-token bg-[rgb(var(--surface))] p-4 shadow-card-hover animate-fade-in-up"
      }
    >
      {children}
    </div>
  );
}

function Quote({ text }: { text: string }) {
  return (
    <blockquote className="line-clamp-3 border-l-2 border-brand-500 pl-2.5 text-xs italic text-muted">
      {text}
    </blockquote>
  );
}

function Composer({
  lessonId,
  anchor,
  x,
  y,
  onClose,
  onSaved,
}: {
  lessonId: string;
  anchor: CapturedAnchor;
  x: number;
  y: number;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!body.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const { ok, data } = await api(`/api/lessons/${lessonId}/annotations`, "POST", {
        ...anchor,
        body: body.trim(),
        published,
      });
      if (!ok) {
        setError(errText(data));
        setSaving(false);
        return;
      }
      await onSaved();
    } catch {
      setError("Không kết nối được máy chủ.");
      setSaving(false);
    }
  }

  return (
    <FloatingCard x={x} y={y} label="Viết annotation" onClose={onClose}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold">Annotation mới</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="rounded-full p-1 text-faint hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))]"
        >
          <X size={16} />
        </button>
      </div>
      <Quote text={anchor.quote} />
      <textarea
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void save();
          }
        }}
        rows={3}
        maxLength={2000}
        placeholder="Bạn nghĩ gì về đoạn này?"
        className="textarea mt-3 resize-none"
      />
      <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={published}
          onChange={(e) => setPublished(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-token"
        />
        <span>
          <span className="font-medium">Chia sẻ với cả lớp</span>
          <span className="block text-xs text-faint">
            {published
              ? "Mọi người trong khoá sẽ thấy và trả lời được annotation này."
              : "Chỉ mình bạn thấy. Có thể chia sẻ sau."}
          </span>
        </span>
      </label>
      {error && <p className="mt-2 text-xs text-danger-700">{error}</p>}
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-[11px] text-faint">Ctrl/⌘ + Enter để lưu</span>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn-sm rounded-lg px-3 text-muted hover:bg-[rgb(var(--surface-muted))]">
            Huỷ
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!body.trim() || saving}
            className="btn-sm rounded-lg bg-brand-600 px-4 font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "Đang lưu…" : "Lưu"}
          </button>
        </div>
      </div>
    </FloatingCard>
  );
}

function Thread({
  lessonId,
  annotation: a,
  x,
  y,
  canModerate,
  onClose,
  onChanged,
  onDeleted,
}: {
  lessonId: string;
  annotation: Annotation;
  x: number;
  y: number;
  canModerate: boolean;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
  onDeleted: () => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(a.body);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const published = a.visibility === "published";
  const base = `/api/lessons/${lessonId}/annotations/${a.id}`;

  async function run(fn: () => Promise<{ ok: boolean; data: Record<string, unknown> }>, after: () => void | Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fn();
      if (!r.ok) setError(errText(r.data));
      else await after();
    } catch {
      setError("Không kết nối được máy chủ.");
    }
    setBusy(false);
  }

  const canDelete = a.mine || (canModerate && published);

  return (
    <FloatingCard x={x} y={y} label="Annotation" onClose={onClose}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{a.mine ? "Bạn" : a.author.displayName}</p>
          <p className="flex items-center gap-1.5 text-xs text-faint">
            <DateTime value={a.createdAt} format="relative" />
            <span aria-hidden>·</span>
            {published ? (
              <span className="inline-flex items-center gap-1"><Globe size={11} /> Cả lớp</span>
            ) : (
              <span className="inline-flex items-center gap-1"><Lock size={11} /> Riêng tư</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="rounded-full p-1 text-faint hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))]"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mt-2">
        <Quote text={a.quote} />
      </div>

      {editing ? (
        <div className="mt-3">
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            maxLength={2000}
            className="textarea resize-none"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => { setEditing(false); setDraft(a.body); }} className="btn-sm rounded-lg px-3 text-muted hover:bg-[rgb(var(--surface-muted))]">
              Huỷ
            </button>
            <button
              type="button"
              disabled={!draft.trim() || busy}
              onClick={() =>
                run(
                  () => api(base, "PATCH", { body: draft.trim() }),
                  async () => { setEditing(false); await onChanged(); },
                )
              }
              className="btn-sm rounded-lg bg-brand-600 px-4 font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Lưu
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{a.body}</p>
      )}

      {(a.mine || canDelete) && !editing && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {a.mine && (
            <>
              <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 rounded-lg border border-token px-2.5 py-1 text-xs hover:bg-[rgb(var(--surface-muted))]">
                <Pencil size={12} /> Sửa
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(
                    () => api(base, "PATCH", { published: !published }),
                    onChanged,
                  )
                }
                className="inline-flex items-center gap-1 rounded-lg border border-token px-2.5 py-1 text-xs hover:bg-[rgb(var(--surface-muted))] disabled:opacity-50"
              >
                {published ? <><Lock size={12} /> Chuyển về riêng tư</> : <><Globe size={12} /> Chia sẻ với cả lớp</>}
              </button>
            </>
          )}
          {canDelete && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const msg = a.mine
                  ? "Xoá annotation này? Các trả lời bên dưới cũng bị xoá."
                  : "Gỡ annotation công khai này khỏi bài?";
                if (!window.confirm(msg)) return;
                void run(() => api(base, "DELETE"), onDeleted);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-token px-2.5 py-1 text-xs text-danger-700 hover:bg-danger-50 disabled:opacity-50"
            >
              <Trash2 size={12} /> {a.mine ? "Xoá" : "Gỡ"}
            </button>
          )}
        </div>
      )}

      {published ? (
        <div className="mt-4 border-t border-token pt-3">
          {a.replies.length > 0 && (
            <ul className="mb-3 space-y-3">
              {a.replies.map((r) => (
                <li key={r.id} className="text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs">
                      <span className="font-semibold">{r.mine ? "Bạn" : r.author.displayName}</span>{" "}
                      <span className="text-faint"><DateTime value={r.createdAt} format="relative" /></span>
                    </p>
                    {(r.mine || canModerate) && (
                      <button
                        type="button"
                        aria-label="Xoá trả lời"
                        disabled={busy}
                        onClick={() => {
                          if (!window.confirm("Xoá trả lời này?")) return;
                          void run(
                            () => api(`${base}/replies/${r.id}`, "DELETE"),
                            onChanged,
                          );
                        }}
                        className="rounded p-1 text-faint hover:bg-[rgb(var(--surface-muted))] hover:text-danger-700"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap leading-relaxed">{r.body}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  document.getElementById(`reply-send-${a.id}`)?.click();
                }
              }}
              rows={1}
              maxLength={2000}
              placeholder="Trả lời…"
              className="textarea min-h-[38px] flex-1 resize-none"
            />
            <button
              id={`reply-send-${a.id}`}
              type="button"
              aria-label="Gửi trả lời"
              disabled={!reply.trim() || busy}
              onClick={() =>
                run(
                  () => api(`${base}/replies`, "POST", { body: reply.trim() }),
                  async () => { setReply(""); await onChanged(); },
                )
              }
              className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-faint">
          Chia sẻ annotation với cả lớp để mọi người cùng trả lời.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-danger-700">{error}</p>}
    </FloatingCard>
  );
}
