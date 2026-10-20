"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { WatermelonSliceIcon } from "./BrandIcons";
import { apiUrl } from "@/lib/apiUrl";
import { cleanQuery, SEARCH_GROUPS, splitHighlight, type SearchHit } from "@/lib/instructorSearchShared";
import { useAssistant } from "./assistant/AssistantProvider";

/** Gợi ý khi ô còn trống (server dựng sẵn từ tình hình của giảng viên). */
export interface SearchSuggestion {
  id: string;
  title: string;
  meta?: string;
  href: string;
}

const DEBOUNCE_MS = 180;

/**
 * Một ô tìm kiếm ở giữa trang chủ giảng viên, kiểu trang chủ Google. Tìm khoá học, bài học, đề thi và slide của chính
 * giảng viên; không thấy đúng ý (hoặc gõ một câu hỏi) thì dòng cuối "Hỏi Lily" chuyển câu đó cho Lily. Enter khi chưa
 * chọn dòng nào = hỏi Lily; mũi tên lên/xuống để chọn dòng rồi Enter để mở.
 */
export default function InstructorHomeSearch({ suggestions }: { suggestions: SearchSuggestion[] }) {
  const router = useRouter();
  const { send, setOpen: setLilyOpen } = useAssistant();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);

  const query = cleanQuery(value);

  // Tìm sau khi ngừng gõ một lát; bỏ kết quả của lần gõ cũ nếu lần mới đã đi trước.
  useEffect(() => {
    if (!query) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(apiUrl(`/api/instructor/search?q=${encodeURIComponent(query)}`), { signal: ctrl.signal });
        const data = (await res.json().catch(() => null)) as { hits?: SearchHit[] } | null;
        setHits(res.ok && Array.isArray(data?.hits) ? data.hits : []);
        setLoading(false);
      } catch (e) {
        if ((e as { name?: string }).name !== "AbortError") {
          setHits([]);
          setLoading(false);
        }
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  useEffect(() => setActive(-1), [query, hits]);

  // Bấm ra ngoài thì thu danh sách.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const askLily = useCallback(
    (text: string) => {
      const q = cleanQuery(text);
      setFocused(false);
      setLilyOpen(true);
      if (q) {
        void send(q, "typed");
        setValue("");
      }
    },
    [send, setLilyOpen],
  );

  // Danh sách phẳng theo thứ tự hiển thị, để mũi tên chọn dòng khớp với cái đang thấy.
  const rows = useMemo(() => {
    type Row = { key: string; label: string; meta: string; href?: string; lily?: boolean };
    if (!query) {
      return suggestions.map<Row>((s) => ({ key: s.id, label: s.title, meta: s.meta ?? "", href: s.href }));
    }
    const out: Row[] = [];
    for (const g of SEARCH_GROUPS) {
      for (const h of hits.filter((x) => x.kind === g.kind)) out.push({ key: `${h.kind}:${h.id}`, label: h.title, meta: h.meta, href: h.href });
    }
    out.push({ key: "lily", label: query, meta: "", lily: true });
    return out;
  }, [query, hits, suggestions]);

  const open = focused && (rows.length > 0 || loading);
  // Dòng mà Enter sẽ chọn khi chưa chọn dòng nào bằng mũi tên: kết quả đầu tiên, trừ khi câu gõ vào là câu hỏi hoặc không có kết quả.
  const firstResult = query && !query.endsWith("?") ? rows.findIndex((r) => !r.lily) : -1;
  const enterIndex = firstResult >= 0 ? firstResult : rows.findIndex((r) => r.lily);

  const choose = (i: number) => {
    const r = rows[i];
    if (!r) return;
    if (r.lily) askLily(query);
    else if (r.href) {
      setFocused(false);
      router.push(r.href);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (rows.length === 0) return;
      e.preventDefault();
      setFocused(true);
      setActive((i) => (e.key === "ArrowDown" ? (i + 1) % rows.length : (i - 1 + rows.length) % rows.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0) choose(active);
      else if (query) {
        // Enter mở kết quả đầu tiên nếu có (gõ tên khoá rồi Enter là để mở khoá, không phải để tốn một lượt hỏi AI). Chỉ
        // hỏi Lily khi không có kết quả nào, hoặc câu gõ vào là một câu hỏi (kết thúc bằng "?"). Đang tìm thì chờ.
        if (loading) return;
        if (enterIndex >= 0) choose(enterIndex);
        else askLily(query);
      }
    } else if (e.key === "Escape") {
      setFocused(false);
      inputRef.current?.blur();
    }
  };

  let lastGroup = "";
  const groupLabel = (r: { href?: string; lily?: boolean }, hit: SearchHit | undefined) => {
    if (!query) return "Hay làm";
    if (r.lily) return "Không thấy đúng ý?";
    return SEARCH_GROUPS.find((g) => g.kind === hit?.kind)?.label ?? "";
  };

  return (
    <div ref={rootRef} className="relative text-left">
      <div
        className={`flex h-[58px] cursor-text items-center gap-3.5 rounded-full border bg-[rgb(var(--surface))] pl-5 pr-2 transition-shadow duration-200 sm:h-16 sm:pl-6 sm:pr-2.5 ${
          focused
            ? "border-brand-500 shadow-[0_0_0_4px_rgb(132_204_22/0.16),0_14px_36px_-14px_rgb(29_36_23/0.26)]"
            : "border-token shadow-[0_6px_22px_-10px_rgb(29_36_23/0.16)] hover:shadow-[0_12px_34px_-14px_rgb(29_36_23/0.26)]"
        }`}
        onClick={() => inputRef.current?.focus()}
      >
        <Search size={20} className="shrink-0 text-faint" aria-hidden />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          aria-label="Tìm kiếm hoặc hỏi Lily"
          placeholder="Tìm khoá học, bài, đề thi… hoặc hỏi Lily cách làm"
          autoComplete="off"
          maxLength={80}
          className="min-w-0 flex-1 border-0 bg-transparent text-[1.05rem] outline-none placeholder:text-muted"
        />
        {/* Cùng kiểu với nút nổi "Hỏi Lily" (AssistantLauncher): viền hồng, nền hồng nhạt, lát dưa hấu, đuôi bong bóng thoại.
            Ở trang chủ nút nổi được ẩn, nên chỉ có một nút này là lối vào Lily. */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            askLily(value);
          }}
          className="group relative flex h-11 shrink-0 items-center gap-2 rounded-full border border-pink-200 bg-pink-50 pl-2.5 pr-3.5 text-[0.9rem] font-semibold text-pink-700 transition hover:-translate-y-px hover:bg-pink-100 active:scale-95 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:h-12 sm:pr-4"
        >
          <span
            className="absolute -bottom-1.5 right-6 h-[11px] w-[11px] rotate-45 border-b border-r border-pink-200 bg-pink-50 transition-colors group-hover:bg-pink-100"
            aria-hidden
          />
          <WatermelonSliceIcon className="h-6 w-6 transition-transform duration-200 group-hover:-rotate-12 motion-reduce:transition-none motion-reduce:group-hover:rotate-0 sm:h-[26px] sm:w-[26px]" />
          <span className="hidden min-[400px]:inline">Hỏi Lily</span>
        </button>
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-2.5 overflow-hidden rounded-[28px] border border-token bg-[rgb(var(--surface))] pb-3 pt-1 shadow-[0_18px_48px_-18px_rgb(29_36_23/0.32)]"
        >
          {rows.length === 0 && loading && <li className="px-6 py-3 text-sm text-faint">Đang tìm…</li>}
          {rows.map((r, i) => {
            const hit = query && !r.lily ? hits.find((h) => `${h.kind}:${h.id}` === r.key) : undefined;
            const label = groupLabel(r, hit);
            const header = label !== lastGroup ? label : null;
            lastGroup = label;
            return (
              <li key={r.key} role="presentation">
                {header && <p className="px-6 pb-1 pt-3.5 text-xs font-semibold text-muted">{header}</p>}
                <Link
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  href={r.href ?? "#"}
                  prefetch={false}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={(e) => {
                    e.preventDefault();
                    choose(i);
                  }}
                  className={`mx-2 flex items-baseline gap-3 rounded-2xl px-4 py-2.5 text-[0.95rem] ${i === active ? "bg-[rgb(var(--surface-muted))]" : ""}`}
                >
                  <span className={`min-w-0 flex-1 truncate ${r.lily ? "font-semibold text-pink-700 dark:text-pink-300" : ""}`}>
                    {r.lily ? (
                      <>Hỏi Lily: “{r.label}”</>
                    ) : query ? (
                      splitHighlight(r.label, query).map((p, k) =>
                        p.hit ? (
                          <mark key={k} className="bg-transparent font-semibold text-brand-700">
                            {p.text}
                          </mark>
                        ) : (
                          <span key={k}>{p.text}</span>
                        ),
                      )
                    ) : (
                      r.label
                    )}
                  </span>
                  {r.meta && !r.lily && <span className="max-w-[40%] shrink-0 truncate text-[0.8125rem] text-muted">{r.meta}</span>}
                  {query && i === enterIndex && active < 0 && <kbd className="shrink-0 rounded-md border border-token px-1.5 text-[0.7rem] font-medium text-muted">Enter</kbd>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
