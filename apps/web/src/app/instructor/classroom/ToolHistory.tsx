"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Check, RefreshCw, RotateCcw, Search, Trash2, X } from "lucide-react";
import type { QuickActivityKind } from "@feedbackme/core-lms";
import { toast } from "@/lib/toast";
import { apiUrl } from "@/lib/apiUrl";
import { formatDateTime, toDayKey } from "@/lib/datetime";

/**
 * Danh sách "…đã tạo trước đây" dùng chung cho 4 Hoạt động nhanh (Vote, Word Cloud,
 * Padlet/Draw-it, Whiteboard): tìm, lọc, xoá từng phiên hoặc nhiều phiên, dọn phiên trống,
 * và thùng rác (khôi phục / xoá vĩnh viễn). Mỗi công cụ giữ kiểu thẻ riêng qua `renderItem`.
 *
 * Xoá ở đây chỉ chuyển vào thùng rác; cron dọn vĩnh viễn sau TRASH_RETENTION_DAYS ngày
 * (khớp với core-lms teaching-tools/quick-activity-trash.ts — không import vì kéo Prisma vào client).
 */

const TRASH_RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
// "Dọn phiên trống" bỏ qua phiên vừa tạo: có thể GV vừa chiếu, học viên chưa kịp gửi.
const EMPTY_MIN_AGE_MS = 60 * 60 * 1000;
const UNDO_MS = 6000;

export interface ToolHistoryEntry {
  id: string;
  /** Câu hỏi / tiêu đề — dùng để tìm kiếm. */
  title: string;
  code?: string;
  /** Số phản hồi; null = công cụ không đếm được (Whiteboard) → không có lọc theo phản hồi. */
  responseCount: number | null;
  createdAt: string;
  deletedAt?: string | null;
  /** Bảng/whiteboard còn mở cho học viên ghi. */
  isOpen?: boolean;
}

type RangeFilter = "all" | "today" | "7d" | "30d";
type ResponseFilter = "all" | "with" | "empty";

interface ToolHistoryProps<T> {
  kind: QuickActivityKind;
  heading: string;
  /** Danh từ trong thông báo, vd "poll", "bảng". */
  noun: string;
  listUrl: string;
  toEntry: (raw: T) => ToolHistoryEntry;
  /** Lọc thêm phía client (vd Padlet và Draw-it dùng chung một API). */
  include?: (raw: T) => boolean;
  onOpen: (raw: T) => void;
  renderItem: (raw: T, index: number) => ReactNode;
  itemStyle?: (raw: T, index: number) => { className?: string; style?: CSSProperties };
  containerClassName: string;
}

export default function ToolHistory<T>({
  kind,
  heading,
  noun,
  listUrl,
  toEntry,
  include,
  onOpen,
  renderItem,
  itemStyle,
  containerClassName,
}: ToolHistoryProps<T>) {
  const [view, setView] = useState<"active" | "trash">("active");
  const [items, setItems] = useState<T[]>([]);
  const [trashItems, setTrashItems] = useState<T[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const [query, setQuery] = useState("");
  const [range, setRange] = useState<RangeFilter>("all");
  const [responses, setResponses] = useState<ResponseFilter>("all");

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetchList = useCallback(
    async (trash: boolean): Promise<T[] | null> => {
      try {
        const res = await fetch(apiUrl(trash ? `${listUrl}?trash=1` : listUrl));
        if (!res.ok) return null;
        const all = (await res.json()) as T[];
        return include ? all.filter(include) : all;
      } catch {
        return null;
      }
    },
    [listUrl, include],
  );

  const reload = useCallback(async () => {
    setIsLoading(true);
    const [active, trash] = await Promise.all([fetchList(false), fetchList(true)]);
    if (active) setItems(active);
    if (trash) setTrashItems(trash);
    if (!active || !trash) toast.error("Lỗi tải lịch sử");
    setIsLoading(false);
  }, [fetchList]);

  useEffect(() => {
    void reload();
    // Chỉ tải khi mở công cụ; nút làm mới gọi lại khi cần.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasResponseCounts = useMemo(() => items.some((i) => toEntry(i).responseCount !== null), [items, toEntry]);

  const source = view === "active" ? items : trashItems ?? [];
  const visible = useMemo(() => {
    const now = Date.now();
    const today = toDayKey(new Date());
    const q = query.trim().toLowerCase();
    return source.filter((raw) => {
      const e = toEntry(raw);
      if (q && !e.title.toLowerCase().includes(q) && !(e.code ?? "").toLowerCase().includes(q)) return false;
      const created = new Date(e.createdAt).getTime();
      if (range === "today" && toDayKey(e.createdAt) !== today) return false;
      if (range === "7d" && now - created > 7 * DAY_MS) return false;
      if (range === "30d" && now - created > 30 * DAY_MS) return false;
      if (responses === "with" && !(e.responseCount && e.responseCount > 0)) return false;
      if (responses === "empty" && e.responseCount !== 0) return false;
      return true;
    });
  }, [source, query, range, responses, toEntry]);

  const filtersActive = query.trim() !== "" || range !== "all" || responses !== "all";

  const exitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const switchView = (next: "active" | "trash") => {
    setView(next);
    exitSelect();
  };

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allVisibleSelected = visible.length > 0 && visible.every((raw) => selected.has(toEntry(raw).id));
  const toggleSelectAll = () => {
    setSelected(allVisibleSelected ? new Set() : new Set(visible.map((raw) => toEntry(raw).id)));
  };

  const callTrash = async (action: "trash" | "restore" | "delete_forever", ids: string[]): Promise<boolean> => {
    try {
      const res = await fetch(apiUrl("/api/instructor/teaching-tools/trash"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, ids, action }),
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  const moveToTrash = async (ids: string[]) => {
    if (ids.length === 0) return;
    const moving = items.filter((raw) => ids.includes(toEntry(raw).id));
    const openCount = moving.filter((raw) => toEntry(raw).isOpen).length;
    if (openCount > 0) {
      const msg =
        openCount === ids.length && ids.length === 1
          ? `${capitalize(noun)} này vẫn đang mở — học viên đang tham gia sẽ bị ngắt. Chuyển vào thùng rác?`
          : `${openCount} ${noun} vẫn đang mở — học viên đang tham gia sẽ bị ngắt. Chuyển ${ids.length} ${noun} vào thùng rác?`;
      if (!confirm(msg)) return;
    }

    setIsBusy(true);
    const ok = await callTrash("trash", ids);
    setIsBusy(false);
    if (!ok) {
      toast.error("Không xoá được, thử lại sau");
      return;
    }
    const now = new Date().toISOString();
    setItems((prev) => prev.filter((raw) => !ids.includes(toEntry(raw).id)));
    // Bản ghi trong thùng rác lấy lại từ server ở lần mở thùng rác; tạm thêm để đếm đúng ngay.
    setTrashItems((prev) => [
      ...moving.map((raw) => ({ ...(raw as object), deletedAt: now, status: "closed" }) as T),
      ...(prev ?? []),
    ]);
    exitSelect();

    toast.success(`Đã chuyển ${ids.length} ${noun} vào thùng rác`, {
      description: `Tự xoá vĩnh viễn sau ${TRASH_RETENTION_DAYS} ngày`,
      duration: UNDO_MS,
      action: { label: "Hoàn tác", onClick: () => void restore(ids, { silent: true }) },
    });
  };

  const restore = async (ids: string[], opts: { silent?: boolean } = {}) => {
    if (ids.length === 0) return;
    setIsBusy(true);
    const ok = await callTrash("restore", ids);
    if (!ok) {
      setIsBusy(false);
      toast.error("Không khôi phục được, thử lại sau");
      return;
    }
    exitSelect();
    await reload();
    setIsBusy(false);
    toast.success(opts.silent ? "Đã hoàn tác" : `Đã khôi phục ${ids.length} ${noun}`);
  };

  const deleteForever = async (ids: string[]) => {
    if (ids.length === 0) return;
    if (!confirm(`Xoá vĩnh viễn ${ids.length} ${noun}? Mọi phản hồi của học viên trong đó cũng mất, không thể hoàn tác.`)) {
      return;
    }
    setIsBusy(true);
    const ok = await callTrash("delete_forever", ids);
    setIsBusy(false);
    if (!ok) {
      toast.error("Không xoá được, thử lại sau");
      return;
    }
    setTrashItems((prev) => (prev ?? []).filter((raw) => !ids.includes(toEntry(raw).id)));
    exitSelect();
    toast.success(`Đã xoá vĩnh viễn ${ids.length} ${noun}`);
  };

  const cleanEmpty = () => {
    const now = Date.now();
    const ids = items
      .map(toEntry)
      .filter((e) => e.responseCount === 0 && !e.isOpen && now - new Date(e.createdAt).getTime() > EMPTY_MIN_AGE_MS)
      .map((e) => e.id);
    if (ids.length === 0) {
      toast.info(`Không có ${noun} trống nào cần dọn`);
      return;
    }
    if (!confirm(`Chuyển ${ids.length} ${noun} không có phản hồi nào vào thùng rác?`)) return;
    void moveToTrash(ids);
  };

  const trashCount = trashItems?.length ?? 0;
  const inTrash = view === "trash";

  return (
    <div className="mt-6 border-t border-token pt-4">
      {/* Đầu mục: tiêu đề + chuyển giữa danh sách và thùng rác */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {inTrash ? (
          <p className="flex items-center gap-2 text-sm font-medium">
            <button onClick={() => switchView("active")} className="text-brand-600 hover:text-brand-700">
              ← Danh sách
            </button>
            <span className="text-muted">·</span>
            <span className="text-muted">Thùng rác</span>
          </p>
        ) : (
          <p className="text-sm font-medium text-muted">{heading}</p>
        )}
        <div className="flex items-center gap-1.5">
          {!inTrash && (
            <button onClick={() => switchView("trash")} className="tool-action" title="Phiên đã xoá, khôi phục được">
              <Trash2 size={12} />
              Thùng rác{trashCount > 0 ? ` (${trashCount})` : ""}
            </button>
          )}
          <button onClick={() => void reload()} disabled={isLoading} className="tool-action" aria-label="Làm mới">
            <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {inTrash && (
        <p className="mb-3 text-xs text-muted">
          {capitalize(noun)} đã xoá nằm đây {TRASH_RETENTION_DAYS} ngày rồi tự xoá vĩnh viễn. Học viên không vào được{" "}
          {noun} trong thùng rác.
        </p>
      )}

      {/* Tìm + lọc */}
      {source.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <label className="relative w-full sm:w-auto sm:min-w-[10rem] sm:flex-1">
            <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo nội dung hoặc mã"
              className="input w-full py-1.5 pl-8 text-sm"
            />
          </label>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as RangeFilter)}
            className="select w-auto min-w-0 flex-1 py-1.5 text-sm sm:flex-none"
            aria-label="Lọc theo thời gian tạo"
          >
            <option value="all">Mọi lúc</option>
            <option value="today">Hôm nay</option>
            <option value="7d">7 ngày qua</option>
            <option value="30d">30 ngày qua</option>
          </select>
          {hasResponseCounts && (
            <select
              value={responses}
              onChange={(e) => setResponses(e.target.value as ResponseFilter)}
              className="select w-auto min-w-0 flex-1 py-1.5 text-sm sm:flex-none"
              aria-label="Lọc theo phản hồi"
            >
              <option value="all">Mọi phiên</option>
              <option value="with">Có phản hồi</option>
              <option value="empty">Chưa có phản hồi</option>
            </select>
          )}
        </div>
      )}

      {/* Thanh thao tác */}
      {source.length > 0 && (
        <div className="mb-3 flex min-h-[2rem] flex-wrap items-center gap-2 text-xs">
          {selectMode ? (
            <>
              <button onClick={toggleSelectAll} className="tool-action">
                {allVisibleSelected ? "Bỏ chọn" : filtersActive ? "Chọn tất cả đang lọc" : "Chọn tất cả"}
              </button>
              <span className="text-muted">Đã chọn {selected.size}</span>
              <div className="ml-auto flex items-center gap-2">
                {inTrash ? (
                  <>
                    <button
                      onClick={() => void restore([...selected])}
                      disabled={selected.size === 0 || isBusy}
                      className="tool-action"
                    >
                      <RotateCcw size={12} /> Khôi phục
                    </button>
                    <button
                      onClick={() => void deleteForever([...selected])}
                      disabled={selected.size === 0 || isBusy}
                      className="tool-action text-danger-600"
                    >
                      Xoá vĩnh viễn
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => void moveToTrash([...selected])}
                    disabled={selected.size === 0 || isBusy}
                    className="tool-action text-danger-600"
                  >
                    <Trash2 size={12} /> Xoá {selected.size > 0 ? selected.size : ""}
                  </button>
                )}
                <button onClick={exitSelect} className="tool-action" aria-label="Thoát chế độ chọn">
                  <X size={12} />
                </button>
              </div>
            </>
          ) : (
            <>
              <button onClick={() => setSelectMode(true)} className="tool-action">
                <Check size={12} /> Chọn
              </button>
              {!inTrash && hasResponseCounts && (
                <button onClick={cleanEmpty} disabled={isBusy} className="tool-action" title="Chuyển các phiên không có phản hồi nào vào thùng rác">
                  Dọn {noun} trống
                </button>
              )}
              {inTrash && (
                <button
                  onClick={() => void deleteForever((trashItems ?? []).map((raw) => toEntry(raw).id))}
                  disabled={isBusy}
                  className="tool-action ml-auto text-danger-600"
                >
                  Dọn sạch thùng rác
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Trạng thái rỗng */}
      {source.length === 0 && !isLoading && (
        <p className="py-2 text-center text-xs text-muted">
          {inTrash ? "Thùng rác trống" : `Chưa có ${noun} nào`}
        </p>
      )}
      {source.length > 0 && visible.length === 0 && (
        <p className="py-2 text-center text-xs text-muted">
          Không có {noun} nào khớp bộ lọc ·{" "}
          <button
            onClick={() => {
              setQuery("");
              setRange("all");
              setResponses("all");
            }}
            className="text-brand-600 underline"
          >
            Bỏ lọc
          </button>
        </p>
      )}

      <div className={containerClassName}>
        {visible.map((raw, idx) => {
          const entry = toEntry(raw);
          const isSelected = selected.has(entry.id);
          const look = itemStyle?.(raw, idx) ?? { className: "tool-list-item" };
          return (
            <div key={entry.id} className="group relative min-w-0">
              <button
                onClick={() => (selectMode ? toggleSelected(entry.id) : inTrash ? undefined : onOpen(raw))}
                disabled={inTrash && !selectMode}
                aria-pressed={selectMode ? isSelected : undefined}
                className={`${look.className ?? ""} ${selectMode ? "pl-9" : "pr-10"} ${
                  isSelected ? "ring-2 ring-brand-500" : ""
                } ${inTrash ? "opacity-80 disabled:cursor-default" : ""}`}
                style={look.style}
              >
                {renderItem(raw, idx)}
                {inTrash && entry.deletedAt && (
                  <p className="mt-1 text-[11px] text-muted">
                    Xoá lúc {formatDateTime(entry.deletedAt)} · còn {daysLeft(entry.deletedAt)} ngày
                  </p>
                )}
              </button>

              {selectMode && (
                <span
                  aria-hidden
                  className={`pointer-events-none absolute left-3 top-3 flex h-4 w-4 items-center justify-center rounded border ${
                    isSelected ? "border-brand-600 bg-brand-600 text-white" : "border-gray-400 bg-[rgb(var(--surface))]"
                  }`}
                >
                  {isSelected && <Check size={11} strokeWidth={3} />}
                </span>
              )}

              {!selectMode && (
                <div className="absolute right-2 top-2 flex gap-1 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
                  {inTrash ? (
                    <>
                      <IconButton label="Khôi phục" onClick={() => void restore([entry.id])} disabled={isBusy}>
                        <RotateCcw size={13} />
                      </IconButton>
                      <IconButton label="Xoá vĩnh viễn" onClick={() => void deleteForever([entry.id])} disabled={isBusy} danger>
                        <Trash2 size={13} />
                      </IconButton>
                    </>
                  ) : (
                    <IconButton label="Xoá" onClick={() => void moveToTrash([entry.id])} disabled={isBusy} danger>
                      <Trash2 size={13} />
                    </IconButton>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`flex h-7 w-7 items-center justify-center rounded-md bg-[rgb(var(--surface))] text-muted shadow-sm ring-1 ring-black/10 transition-colors disabled:opacity-50 ${
        danger ? "hover:bg-danger-50 hover:text-danger-600" : "hover:bg-[rgb(var(--surface-muted))]"
      }`}
    >
      {children}
    </button>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function daysLeft(deletedAt: string): number {
  const left = TRASH_RETENTION_DAYS * DAY_MS - (Date.now() - new Date(deletedAt).getTime());
  return Math.max(0, Math.ceil(left / DAY_MS));
}
