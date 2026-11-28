"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";

/** Tô đậm đoạn khớp với chữ đang gõ trong một dòng gợi ý. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-sm bg-brand-100 px-0 text-inherit dark:bg-brand-900/40">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

interface SuggestBoxProps<T> {
  /** Chữ trong ô nhập (điều khiển từ ngoài, để form cha đọc được). */
  value: string;
  onValueChange: (v: string) => void;
  /** Gọi sau khi gõ xong (đã debounce). Trả mảng rỗng nếu không có gợi ý. Có `signal` để huỷ lượt cũ. */
  fetchSuggestions: (query: string, signal: AbortSignal) => Promise<T[]>;
  getKey: (item: T) => string;
  /** Nội dung một dòng gợi ý. */
  renderItem: (item: T, ctx: { query: string; active: boolean }) => ReactNode;
  /** Dòng bị khoá vẫn hiện (để người dùng hiểu vì sao) nhưng không chọn được. */
  isDisabled?: (item: T) => boolean;
  onSelect: (item: T) => void;
  /** Gõ ít hơn số này thì không tìm. 0 = hiện gợi ý ngay khi bấm vào ô (vd danh sách khoá mới nhất). */
  minChars?: number;
  /** Chữ hiện khi tìm không ra gì (sau khi gõ đủ ký tự). */
  emptyText?: ReactNode;
  /** Chữ hướng dẫn khi chưa gõ đủ ký tự. */
  hintText?: ReactNode;
  id?: string;
  type?: "text" | "email" | "search";
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
  ariaLabel?: string;
  inputClassName?: string;
  debounceMs?: number;
}

/**
 * Ô nhập có danh sách gợi ý (combobox). Gõ → gợi ý hiện sau ~250 ms; ↑/↓ chọn dòng, Enter chọn, Esc đóng,
 * bấm ra ngoài đóng. Dòng bị khoá (`isDisabled`) hiện mờ và bị bỏ qua khi di chuyển bằng phím.
 * Chọn một dòng chỉ gọi `onSelect`; việc làm gì tiếp (điền vào ô, thêm luôn…) do nơi gọi quyết định.
 */
export default function SuggestBox<T>({
  value,
  onValueChange,
  fetchSuggestions,
  getKey,
  renderItem,
  isDisabled,
  onSelect,
  minChars = 2,
  emptyText = "Không có gợi ý nào khớp.",
  hintText,
  id,
  type = "text",
  placeholder,
  required,
  autoFocus,
  ariaLabel,
  inputClassName = "input",
  debounceMs = 250,
}: SuggestBoxProps<T>) {
  const uid = useId();
  const listId = `${uid}-list`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(-1);
  // Chữ đã tìm xong gần nhất: để biết "không có gợi ý" là đúng với chữ đang hiện, không phải kết quả của chữ cũ.
  const [searched, setSearched] = useState<string | null>(null);

  const query = value.trim();
  const enough = query.length >= minChars;

  // Chỉ tìm khi đang mở. Mỗi lần gõ huỷ lượt trước (AbortController) để kết quả cũ không đè kết quả mới.
  useEffect(() => {
    if (!open || !enough) {
      setItems([]);
      setSearched(null);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setFailed(false);
    const t = setTimeout(() => {
      fetchSuggestions(query, ctrl.signal)
        .then((r) => {
          if (ctrl.signal.aborted) return;
          setItems(r);
          setSearched(query);
          setActive(-1);
        })
        .catch(() => {
          if (!ctrl.signal.aborted) {
            setFailed(true);
            setItems([]);
          }
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setLoading(false);
        });
    }, debounceMs);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // fetchSuggestions cố ý không nằm trong deps: nơi gọi thường truyền hàm mới mỗi lần render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open, enough, debounceMs]);

  // Bấm ra ngoài thì đóng.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const disabledAt = useCallback((i: number) => (items[i] !== undefined && isDisabled ? isDisabled(items[i] as T) : false), [items, isDisabled]);

  function move(dir: 1 | -1) {
    if (items.length === 0) return;
    let i = active;
    for (let step = 0; step < items.length; step++) {
      i = (i + dir + items.length) % items.length;
      if (!disabledAt(i)) {
        setActive(i);
        return;
      }
    }
  }

  function choose(item: T) {
    setOpen(false);
    onSelect(item);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (open) move(-1);
    } else if (e.key === "Enter") {
      // Chỉ chặn gửi form khi đang chọn một dòng; còn lại Enter gửi form như thường.
      if (open && active >= 0 && items[active] !== undefined && !disabledAt(active)) {
        e.preventDefault();
        choose(items[active] as T);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  const showPanel = open && (enough ? true : Boolean(hintText));
  const showEmpty = enough && !loading && !failed && searched === query && items.length === 0;

  return (
    <div ref={rootRef} className="relative">
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className={inputClassName}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        autoComplete="off"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${uid}-opt-${active}` : undefined}
        aria-label={ariaLabel}
      />
      {showPanel && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-token bg-[rgb(var(--surface))] shadow-card">
          {!enough && hintText && <p className="px-3 py-2 text-xs text-muted">{hintText}</p>}
          {enough && loading && items.length === 0 && <p className="px-3 py-2 text-sm text-muted">Đang tìm…</p>}
          {failed && <p className="px-3 py-2 text-sm text-danger">Chưa tìm được, thử gõ lại.</p>}
          {showEmpty && <div className="px-3 py-2 text-sm text-muted">{emptyText}</div>}
          {items.length > 0 && (
            <ul id={listId} role="listbox" className={`max-h-72 overflow-y-auto ${loading ? "opacity-60" : ""}`}>
              {items.map((item, i) => {
                const disabled = isDisabled?.(item) ?? false;
                return (
                  <li
                    key={getKey(item)}
                    id={`${uid}-opt-${i}`}
                    role="option"
                    aria-selected={i === active}
                    aria-disabled={disabled || undefined}
                    // mousedown (không phải click) + preventDefault: giữ focus ở ô nhập, không bị blur đóng danh sách trước khi chọn.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (!disabled) choose(item);
                    }}
                    onMouseEnter={() => !disabled && setActive(i)}
                    className={`px-3 py-2 text-sm ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${
                      i === active ? "bg-[rgb(var(--surface-muted))]" : ""
                    }`}
                  >
                    {renderItem(item, { query, active: i === active })}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
