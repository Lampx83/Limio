"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Headphones, ListChecks, Mic, Shuffle, TextCursorInput, type LucideIcon } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { PRACTICE_COMPLETE_EVENT, PRACTICE_KIND_LABEL, PRACTICE_PROGRESS_EVENT, type PracticeKind, type PracticeProgressDetail, type PracticeTabMeta } from "@/lib/practiceTabMeta";

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
export default function PracticeTabs({ tabs, hsk = false }: { tabs: PracticeTab[]; hsk?: boolean }) {
  const uid = useId();
  const tr = useT();
  const [active, setActive] = useState(0);
  // Thanh bài tập gọn dính ở đầu màn hình («  3/7 · tên bài  ▾  »): đổi bài tập mà không phải cuộn ngược lên; lưới thẻ chỉ mở khi cần xem cả danh sách.
  const secRef = useRef<HTMLElement>(null);
  const [listOpen, setListOpen] = useState(false);
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
  // Báo cho thanh đáy: mọi bài tập có câu đã được kiểm hết chưa (nút "Tiếp" đổi mức nhấn). Chỉ báo khi có ít nhất một bài tập có câu.
  const allChecked = tabs.some((tb) => (tb.meta?.ids?.length ?? 0) > 0) && tabs.every((tb) => (tb.meta?.ids?.length ?? 0) === 0 || progressOf(tb.meta, live).done);
  const hasQuestions = tabs.some((tb) => (tb.meta?.ids?.length ?? 0) > 0);
  useEffect(() => {
    if (!hasQuestions) return;
    window.dispatchEvent(new CustomEvent(PRACTICE_COMPLETE_EVENT, { detail: { done: allChecked } }));
  }, [allChecked, hasQuestions]);
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
  // Đổi bài tập bằng nút dính: về đầu khu bài luyện nếu đang cuộn sâu, để thấy bài tập mới từ đầu.
  const step = (dir: -1 | 1) => {
    if (cur + dir < 0 || cur + dir > tabs.length - 1) return;
    // Dạng hàm: bấm nhanh hai lần liền vẫn đi đủ hai bài, không dựa vào giá trị cũ của lần dựng trước.
    setActive((a) => Math.min(tabs.length - 1, Math.max(0, Math.min(a, tabs.length - 1) + dir)));
    setListOpen(false);
    const el = secRef.current;
    if (el && el.getBoundingClientRect().top < 72) el.scrollIntoView?.({ block: "start", behavior: "smooth" });
  };
  const barTitle = (tb: PracticeTab) => {
    const head = tb.label.split(" · ")[0] ?? "";
    if (!EXERCISE_CODE.test(head)) return tb.label.replace(" · ", ": ");
    return tb.meta?.title && tb.meta.title !== head ? `${head} · ${tb.meta.title}` : tb.label;
  };
  const curDone = progressOf(tabs[cur]?.meta, live).done;
  const stepBtn = "flex w-11 shrink-0 items-center justify-center bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40";
  const stepBar =
    tabs.length > 1 ? (
      <div role="group" aria-label={tr("practice.tabs.aria")} data-testid="practice-step-nav" className="sticky top-[3.75rem] z-20 mb-3 flex items-stretch border border-token bg-[rgb(var(--surface))] shadow-sm">
        <button type="button" onClick={() => step(-1)} disabled={cur === 0} aria-label={tr("practice.tabs.prev")} className={stepBtn}>
          <ChevronsLeft size={18} aria-hidden />
        </button>
        <button type="button" onClick={() => setListOpen((v) => !v)} aria-expanded={listOpen} aria-label={tr("practice.tabs.list")} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left">
          <span className="shrink-0 text-sm font-bold tabular-nums text-brand-700" aria-label={tr("practice.tabs.counter", { n: cur + 1, total: tabs.length })}>
            {tr("practice.tabs.label")} {cur + 1}/{tabs.length}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{barTitle(tabs[cur]!)}</span>
          {curDone && <Check size={16} aria-hidden className="shrink-0 text-lime-700" />}
          <ChevronDown size={16} aria-hidden className={`shrink-0 text-muted transition-transform ${listOpen ? "rotate-180" : ""}`} />
        </button>
        <button type="button" onClick={() => step(1)} disabled={cur === tabs.length - 1} aria-label={tr("practice.tabs.next")} className={stepBtn}>
          <ChevronsRight size={18} aria-hidden />
        </button>
      </div>
    ) : null;

  if (hsk) {
    // Giao diện bài HSK: lưới thẻ hoạt động (biểu tượng, tên, số câu, thanh tiến độ); thẻ đang mở màu hồng, nội dung mở ngay bên dưới.
    return (
      <section ref={secRef} className="hsk-tabs" data-testid="practice-tabs">
        {stepBar}
        <div role="tablist" aria-label={tr("practice.tabs.aria")} className="hsk-tablist" style={listOpen ? undefined : { display: "none" }}>
          {tabs.map((t, i) => {
            const on = i === cur;
            const kind = t.meta?.kind;
            const Icon = kind ? KIND_ICON[kind] : null;
            const pr = progressOf(t.meta, live);
            const glued = t.meta ? /^(\d+[A-E]?(?:[–-]\d*[A-E])?)\s+([^·].*)$/.exec(t.label) : null;
            const [head, ...restParts] = glued ? [glued[1]!, glued[2]!] : t.meta ? t.label.split(" · ") : [t.label];
            const isCode = !t.meta || EXERCISE_CODE.test(head ?? "");
            const title = !t.meta ? t.label : isCode ? (t.meta.title && t.meta.title !== head ? t.meta.title : restParts.join(" · ") || (head ?? t.label)) : t.label.replace(" · ", ": ");
            const sub = pr.done ? "Xong" : pr.total === 0 ? (kind ? PRACTICE_KIND_LABEL[kind] : "") : pr.answered > 0 ? `${pr.answered}/${pr.total} câu` : `${pr.total} câu`;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`${uid}-tab-${i}`}
                aria-selected={on}
                aria-controls={`${uid}-panel-${i}`}
                tabIndex={on ? 0 : -1}
                onClick={() => {
                  setActive(i);
                  setListOpen(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight") {
                    e.preventDefault();
                    go(cur + 1);
                  } else if (e.key === "ArrowLeft") {
                    e.preventDefault();
                    go(cur - 1);
                  }
                }}
                className="hsk-tab"
              >
                <span className="hsk-tab-ic" aria-hidden>
                  {pr.done ? <Check size={20} /> : Icon ? <Icon size={20} /> : <BookOpen size={20} />}
                </span>
                <span className="min-w-0">
                  <b className="hsk-tab-t">{title}</b>
                  {sub && <small>{sub}</small>}
                </span>
                {pr.total > 0 && (
                  <span className="hsk-tab-bar" aria-hidden>
                    <i style={{ width: `${Math.round((pr.done ? 1 : pr.answered / pr.total) * 100)}%` }} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {tabs.map((t, i) => (
          <div key={t.id} role="tabpanel" id={`${uid}-panel-${i}`} aria-labelledby={`${uid}-tab-${i}`} hidden={i !== cur}>
            {t.content}
          </div>
        ))}
      </section>
    );
  }

  return (
    <section ref={secRef} className={hsk ? "hsk-tabs mt-5" : "mt-5"} data-testid="practice-tabs">
      {stepBar}
      <div className="relative" style={listOpen ? undefined : { display: "none" }}>
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
        aria-label={tr("practice.tabs.aria")}
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
              onClick={() => {
                  setActive(i);
                  setListOpen(false);
                }}
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
