"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { BookOpen, Check, ChevronLeft, ChevronRight, Headphones, ListChecks, Mic, Shuffle, TextCursorInput, type LucideIcon } from "lucide-react";
import { PRACTICE_KIND_LABEL, PRACTICE_PROGRESS_EVENT, type PracticeKind, type PracticeProgressDetail, type PracticeTabMeta } from "@/lib/practiceTabMeta";

export interface PracticeTab {
  id: string;
  label: string;
  content: React.ReactNode;
  /** Loại bài, tên bài và các câu của tab: để thẻ tab hiện biểu tượng, tên và tiến độ. Không có thì thẻ chỉ có mã bài. */
  meta?: PracticeTabMeta;
}

const KIND_ICON: Record<PracticeKind, LucideIcon> = {
  speak: Mic,
  listen: Headphones,
  choose: ListChecks,
  write: TextCursorInput,
  match: Shuffle,
  read: BookOpen,
};

const EXERCISE_CODE = /^\d+[A-E]?(?:[–-]\d*[A-E])?(?:,\s*\d+[A-E]?)*$/;

type Live = Record<string, { a: boolean; c: boolean }>;

function progressOf(meta: PracticeTabMeta | undefined, live: Live) {
  const ids = meta?.ids ?? [];
  const a0 = new Set(meta?.answered ?? []);
  const c0 = new Set(meta?.checked ?? []);
  let answered = 0;
  let checked = 0;
  for (const id of ids) {
    const l = live[id];
    if (l ? l.a : a0.has(id)) answered++;
    if (l ? l.c : c0.has(id)) checked++;
  }
  return { total: ids.length, answered, checked, done: ids.length > 0 && checked === ids.length };
}

/**
 * Khu bài luyện của bài ngoại ngữ (không có tiêu đề riêng: thanh tab là đủ): mỗi khối Bài luyện là một tab (docs/tieu-chi/limio-language-y-kien-hoc-vien-giao-dien.md, AC5).
 * Mọi tab đều nằm trong cây (tab không chọn chỉ ẩn) nên bài đang làm không mất khi chuyển qua lại.
 * Chỉ một khối mà tên không phải số exercise thì không có thanh tab.
 */
export default function PracticeTabs({ tabs }: { tabs: PracticeTab[] }) {
  const uid = useId();
  const [active, setActive] = useState(0);
  const [live, setLive] = useState<Live>({});
  useEffect(() => {
    const onProgress = (e: Event) => {
      const d = (e as CustomEvent<PracticeProgressDetail>).detail;
      if (!d) return;
      const a = new Set(d.answered);
      const c = new Set(d.checked);
      setLive((prev) => {
        const next = { ...prev };
        for (const id of d.ids) next[id] = { a: a.has(id), c: c.has(id) };
        return next;
      });
    };
    window.addEventListener(PRACTICE_PROGRESS_EVENT, onProgress);
    return () => window.removeEventListener(PRACTICE_PROGRESS_EVENT, onProgress);
  }, []);
  // Hàng thẻ cuộn ngang: biết còn thẻ bị che ở mép nào để mờ mép và hiện nút mũi tên.
  const barRef = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });
  const measure = useCallback(() => {
    const el = barRef.current;
    if (!el) return;
    const left = el.scrollLeft > 2;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdge((e) => (e.left === left && e.right === right ? e : { left, right }));
  }, []);
  useEffect(() => {
    measure();
    const el = barRef.current;
    window.addEventListener("resize", measure);
    const ro = typeof ResizeObserver !== "undefined" && el ? new ResizeObserver(measure) : null;
    if (ro && el) ro.observe(el);
    return () => {
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, [measure, tabs.length]);
  // Thẻ đang mở luôn nằm trong tầm nhìn (chỉ cuộn trong hàng thẻ, không cuộn cả trang).
  useEffect(() => {
    const bar = barRef.current;
    const el = document.getElementById(`${uid}-tab-${active}`);
    if (!bar || !el || bar.scrollWidth <= bar.clientWidth) return;
    if (el.offsetLeft < bar.scrollLeft) bar.scrollTo({ left: Math.max(0, el.offsetLeft - 40), behavior: "smooth" });
    else if (el.offsetLeft + el.offsetWidth > bar.scrollLeft + bar.clientWidth) bar.scrollTo({ left: el.offsetLeft + el.offsetWidth - bar.clientWidth + 40, behavior: "smooth" });
  }, [active, uid]);
  const scrollBar = (dir: -1 | 1) => barRef.current?.scrollBy({ left: dir * Math.max(120, (barRef.current?.clientWidth ?? 300) * 0.7), behavior: "smooth" });
  if (tabs.length === 0) return null;
  // Một khối: không cần chuyển tab, nhưng nếu tên là số exercise ("6", "2A") thì vẫn hiện số đó để biết đang làm bài tập nào.
  if (tabs.length === 1 && !/^\d/.test(tabs[0]!.label)) return <div>{tabs[0]!.content}</div>;
  const cur = Math.min(active, tabs.length - 1);
  const go = (i: number) => setActive((i + tabs.length) % tabs.length);

  return (
    <section className="mt-5" data-testid="practice-tabs">
      <div className="relative">
      {edge.left && (
        <button type="button" onClick={() => scrollBar(-1)} aria-label="Cuộn hàng bài tập sang trái" className="absolute left-0 top-10 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-token bg-[rgb(var(--surface))] text-muted shadow-sm hover:text-[rgb(var(--text))]">
          <ChevronLeft size={18} aria-hidden />
        </button>
      )}
      {edge.right && (
        <button type="button" onClick={() => scrollBar(1)} aria-label="Cuộn hàng bài tập sang phải" className="absolute right-0 top-10 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-token bg-[rgb(var(--surface))] text-muted shadow-sm hover:text-[rgb(var(--text))]">
          <ChevronRight size={18} aria-hidden />
        </button>
      )}
      <div
        ref={barRef}
        onScroll={measure}
        role="tablist"
        aria-label="Bài luyện của bài học"
        className="relative -mx-2 overflow-x-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          maskImage: `linear-gradient(to right, transparent 0, #000 ${edge.left ? "2.5rem" : "0px"}, #000 calc(100% - ${edge.right ? "2.5rem" : "0px"}), transparent 100%)`,
          WebkitMaskImage: `linear-gradient(to right, transparent 0, #000 ${edge.left ? "2.5rem" : "0px"}, #000 calc(100% - ${edge.right ? "2.5rem" : "0px"}), transparent 100%)`,
        }}
      >
        {/* Đường kẻ màu nhấn chạy suốt dưới hàng thẻ; thẻ đang mở hở đáy và nối thẳng vào nó, nên thấy rõ thẻ nào đang mở nội dung bên dưới. */}
        <div className="flex w-max min-w-full items-end gap-2 border-b-2 border-brand-600">
        {tabs.map((t, i) => {
          const on = i === cur;
          const kind = t.meta?.kind;
          const Icon = kind ? KIND_ICON[kind] : null;
          const pr = progressOf(t.meta, live);
          const kindLabel = kind ? PRACTICE_KIND_LABEL[kind] : "";
          // Có thông tin bài tập: nhãn dài ("Free practice · Talk with a virtual partner") tách thành mã ngắn trên huy hiệu và tên bài bên dưới.
          // "6 Listen to two lifestyles" (mã dính liền chữ): mã thành huy hiệu, phần còn lại là tên.
          const glued = t.meta ? /^(\d+[A-E]?(?:[–-]\d*[A-E])?)\s+([^·].*)$/.exec(t.label) : null;
          const [head, ...restParts] = glued ? [glued[1]!, glued[2]!] : t.meta ? t.label.split(" · ") : [t.label];
          const isCode = !t.meta || EXERCISE_CODE.test(head ?? "");
          // Mã bài tập của sách ("5A", "5B–5C") thành huy hiệu; nhãn chữ ("Free practice · Talk with…") không có mã nên cả nhãn là tên bài.
          const badge = isCode ? (head ?? t.label) : "";
          const cardTitle = !t.meta
            ? ""
            : isCode
              ? t.meta.title && t.meta.title !== badge
                ? t.meta.title
                : restParts.join(" · ")
              : t.label.replace(" · ", ": ");
          const status = !t.meta
            ? ""
            : pr.done
              ? "Xong"
              : pr.total === 0
                ? kindLabel
                : pr.answered > 0
                  ? `${pr.answered}/${pr.total} câu`
                  : `${pr.total} câu`;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`${uid}-tab-${i}`}
              aria-selected={on}
              aria-controls={`${uid}-panel-${i}`}
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") {
                  e.preventDefault();
                  go(cur + 1);
                } else if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  go(cur - 1);
                }
              }}
              title={kindLabel || undefined}
              className={`flex shrink-0 flex-col gap-1 rounded-t-xl text-left transition-colors ${t.meta ? `w-28 ${on ? "h-[calc(6.9rem+2px)]" : "h-[6.9rem]"}` : ""} ${
                on
                  ? "-mb-0.5 border-2 border-b-0 border-brand-600 p-[0.4375rem] pb-[calc(0.5rem+2px)] [background:linear-gradient(rgb(var(--brand)/0.08),rgb(var(--brand)/0.08)),rgb(var(--surface))]"
                  : "mb-0 border border-b-0 border-token bg-[rgb(var(--surface))] p-2 hover:border-[rgb(var(--text)/0.35)]"
              }`}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="flex min-w-0 flex-col items-start gap-0.5">
                  {t.meta && <span className={`text-[0.6875rem] font-medium leading-none ${on ? "text-brand-700" : "text-muted"}`}>{badge ? "Exercise" : "Activity"}</span>}
                  {badge && (
                    <span className={`whitespace-nowrap rounded-md px-2 py-0.5 text-sm font-semibold sm:text-base ${on ? "bg-brand-600 text-white" : "bg-black/5 dark:bg-white/10"}`}>{badge}</span>
                  )}
                </span>
                {pr.done ? <Check size={18} aria-hidden className="text-lime-700" /> : Icon && <Icon size={18} aria-hidden className={on ? "text-[rgb(var(--brand))]" : "text-muted"} />}
              </span>
              {cardTitle && <span className={`text-xs leading-snug ${badge ? "line-clamp-2" : "line-clamp-3 font-medium"} ${on ? "" : "text-muted"}`}>{cardTitle}</span>}
              {/* Tiến độ là thanh mảnh ở đáy thẻ (không chiếm chỗ bằng chữ); trình đọc màn hình vẫn nghe số câu. */}
              {status && <span className="sr-only">{status}</span>}
              {pr.total > 0 && (
                <span className="mt-auto block h-1 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/15" aria-hidden>
                  <span className={`block h-full rounded-full ${pr.done ? "bg-lime-600" : "bg-brand-600"}`} style={{ width: `${Math.round((pr.done ? 1 : pr.answered / pr.total) * 100)}%` }} />
                </span>
              )}
            </button>
          );
        })}
        </div>
      </div>
      </div>
      {tabs.map((t, i) => (
        <div key={t.id} role="tabpanel" id={`${uid}-panel-${i}`} aria-labelledby={`${uid}-tab-${i}`} hidden={i !== cur} className="pt-3">
          {t.content}
        </div>
      ))}
    </section>
  );
}
