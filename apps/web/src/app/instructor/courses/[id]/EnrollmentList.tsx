"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type ComponentType,
  type SVGProps,
} from "react";
import { createPortal } from "react-dom";
import {
  MoreVertical,
  Check,
  Layers,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ArrowLeftRight,
} from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { formatDate } from "@/lib/datetime";
import DateTime from "@/components/ui/DateTime";

interface Enrollment {
  id: string;
  status: "active" | "completed" | "dropped" | "refunded";
  courseVersion: number;
  enrolledAt: string;
  completedAt: string | null;
  lastLessonId: string | null;
  lastPositionSec: number | null;
  lastActivityAt: string | null;
  section: { name: string; isDefault: boolean };
  user: {
    id: string;
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

interface Stats {
  total: number;
  active: number;
  completed: number;
  dropped: number;
  refunded: number;
}

interface SectionOption {
  id: string;
  name: string;
}

type Filter = "all" | Enrollment["status"];

type SortKey = "name" | "section" | "status" | "enrolledAt" | "lastActivityAt";
type SortDir = "asc" | "desc";

/** Cột ngày mặc định sort mới nhất trước; cột chữ mặc định A→Z. */
const DEFAULT_DIR: Record<SortKey, SortDir> = {
  name: "asc",
  section: "asc",
  status: "asc",
  enrolledAt: "desc",
  lastActivityAt: "desc",
};

function sortValue(e: Enrollment, key: SortKey): string | number {
  switch (key) {
    case "name":
      return (e.user.displayName ?? e.user.email).toLowerCase();
    case "section":
      return e.section.isDefault ? "" : e.section.name.toLowerCase();
    case "status":
      return STATUS_LABEL[e.status];
    case "enrolledAt":
      return new Date(e.enrolledAt).getTime();
    case "lastActivityAt":
      return e.lastActivityAt ? new Date(e.lastActivityAt).getTime() : 0;
  }
}

/**
 * Danh sách học viên trả về TÊN lớp, còn ô chọn cần ID. Đối chiếu theo tên là
 * đủ tin: tên lớp unique trong một khoá (ràng buộc @@unique([courseId, name])).
 */
function sectionIdOf(
  e: { section: { name: string; isDefault: boolean } },
  sections: SectionOption[],
): string {
  if (e.section.isDefault) return "";
  return sections.find((s) => s.name === e.section.name)?.id ?? "";
}

const STATUS_LABEL: Record<Enrollment["status"], string> = {
  active: "Đang học",
  completed: "Đã hoàn thành",
  dropped: "Bỏ học",
  refunded: "Đã hoàn tiền",
};

const STATUS_CHIP: Record<Enrollment["status"], string> = {
  active: "chip-success",
  completed: "chip-brand",
  dropped: "chip-danger",
  refunded: "chip-accent",
};

/** Chấm màu trong menu hành động — cùng tông với STATUS_CHIP ở trên. */
const STATUS_DOT: Record<Enrollment["status"], string> = {
  active: "bg-success-500",
  completed: "bg-brand-500",
  dropped: "bg-danger-500",
  refunded: "bg-accent-500",
};

export default function EnrollmentList({ courseId }: { courseId: string }) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("enrolledAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Bảng nhiều cột luôn cuộn ngang được, nhưng scrollbar mặc định của macOS chỉ
  // hiện khi đang thao tác (chế độ "khi cuộn") — khiến bảng trông như bị cắt
  // cụt mà không có gợi ý nào là còn xem được nữa. Thanh cuộn tự vẽ này +
  // vệt mờ bên phải luôn hiện khi bảng còn tràn, mất đi khi đã cuộn hết.
  const tableWrapRef = useRef<HTMLDivElement>(null);
  const scrollTrackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ dragging: boolean; startX: number; startScroll: number }>({
    dragging: false,
    startX: 0,
    startScroll: 0,
  });
  const [scrollUI, setScrollUI] = useState({
    overflow: false,
    thumbWidthPct: 100,
    thumbLeftPct: 0,
    atEnd: true,
  });

  const updateScrollUI = useCallback(() => {
    const el = tableWrapRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 2) {
      setScrollUI({ overflow: false, thumbWidthPct: 100, thumbLeftPct: 0, atEnd: true });
      return;
    }
    const ratio = Math.max(0.08, el.clientWidth / el.scrollWidth);
    const pos = el.scrollLeft / maxScroll;
    setScrollUI({
      overflow: true,
      thumbWidthPct: ratio * 100,
      thumbLeftPct: pos * (100 - ratio * 100),
      atEnd: el.scrollLeft >= maxScroll - 2,
    });
  }, []);

  function onThumbMouseDown(e: React.MouseEvent) {
    dragRef.current = { dragging: true, startX: e.clientX, startScroll: tableWrapRef.current?.scrollLeft ?? 0 };
    e.preventDefault();
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragRef.current.dragging) return;
      const el = tableWrapRef.current;
      const track = scrollTrackRef.current;
      if (!el || !track) return;
      const maxScroll = el.scrollWidth - el.clientWidth;
      const delta = ((e.clientX - dragRef.current.startX) / track.clientWidth) * el.scrollWidth;
      el.scrollLeft = Math.min(maxScroll, Math.max(0, dragRef.current.startScroll + delta));
    }
    function onUp() {
      dragRef.current.dragging = false;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  function onTrackClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return; // bấm đúng lên track, không phải thumb
    const el = tableWrapRef.current;
    const track = scrollTrackRef.current;
    if (!el || !track) return;
    const rect = track.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const maxScroll = el.scrollWidth - el.clientWidth;
    el.scrollLeft = ratio * maxScroll;
  }

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(DEFAULT_DIR[key]);
    }
  }

  const sortedEnrollments = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...enrollments].sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [enrollments, sortKey, sortDir]);

  useEffect(() => {
    const raf = requestAnimationFrame(updateScrollUI);
    window.addEventListener("resize", updateScrollUI);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", updateScrollUI);
    };
  }, [sortedEnrollments, updateScrollUI]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (filter !== "all") params.set("status", filter);
    if (search.trim()) params.set("q", search.trim());
    try {
      const res = await fetch(
        apiUrl(`/api/instructor/courses/${courseId}/enrollments?${params}`),
      );
      if (!res.ok) throw new Error(`http_${res.status}`);
      const data = await res.json();
      setEnrollments(data.enrollments);
      setStats(data.stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : "load_failed");
    } finally {
      setLoading(false);
    }
  }, [courseId, filter, search]);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  // Danh sách lớp để gán — tải một lần, không đổi theo bộ lọc học viên.
  useEffect(() => {
    let bỏ = false;
    void fetch(apiUrl(`/api/courses/${courseId}/sections`))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!bỏ && j?.sections) {
          setSections(
            (j.sections as Array<{ id: string; name: string }>).map((x) => ({
              id: x.id,
              name: x.name,
            })),
          );
        }
      })
      .catch(() => {
        // Không tải được danh sách lớp thì ô gán lớp ẩn đi; phần còn lại của
        // bảng vẫn dùng bình thường.
      });
    return () => {
      bỏ = true;
    };
  }, [courseId]);

  async function assignSection(enrollment: Enrollment, sectionId: string) {
    if (!sectionId) return;
    setBusyId(enrollment.id);
    const res = await fetch(
      apiUrl(`/api/instructor/courses/${courseId}/enrollments/${enrollment.id}`),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId }),
      },
    );
    setBusyId(null);
    if (res.ok) {
      void load();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(`assign_failed: ${d.error ?? res.status}`);
    }
  }

  async function changeStatus(
    enrollment: Enrollment,
    next: Enrollment["status"],
  ) {
    if (next === enrollment.status) return;
    if (
      next === "dropped" &&
      !confirm(
        `Đánh dấu "${enrollment.user.displayName ?? enrollment.user.email}" là bỏ học?`,
      )
    )
      return;

    setBusyId(enrollment.id);
    const res = await fetch(
      apiUrl(
        `/api/instructor/courses/${courseId}/enrollments/${enrollment.id}`,
      ),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      },
    );
    setBusyId(null);
    if (res.ok) {
      void load();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(`patch_failed: ${d.error ?? res.status}`);
    }
  }

  async function removeEnrollment(enrollment: Enrollment) {
    const label = enrollment.user.displayName ?? enrollment.user.email;
    if (
      !confirm(
        `Xoá hẳn "${label}" khỏi khoá học? Toàn bộ enrollment (lớp, trạng thái, tiến độ xem dở) sẽ mất, không phục hồi được.`,
      )
    )
      return;

    setBusyId(enrollment.id);
    const res = await fetch(
      apiUrl(`/api/instructor/courses/${courseId}/enrollments/${enrollment.id}`),
      { method: "DELETE" },
    );
    setBusyId(null);
    if (res.ok) {
      void load();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(`remove_failed: ${d.error ?? res.status}`);
    }
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Tổng"
            value={stats.total}
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          <StatCard
            label="Đang học"
            value={stats.active}
            tone="success"
            active={filter === "active"}
            onClick={() => setFilter("active")}
          />
          <StatCard
            label="Hoàn thành"
            value={stats.completed}
            tone="brand"
            active={filter === "completed"}
            onClick={() => setFilter("completed")}
          />
          <StatCard
            label="Bỏ học"
            value={stats.dropped}
            tone="danger"
            active={filter === "dropped"}
            onClick={() => setFilter("dropped")}
          />
        </div>
      )}

      {/* Search */}
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔎 Tìm theo tên hoặc email..."
        className="input"
      />

      {error && (
        <p className="rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">
          Lỗi: {error}
        </p>
      )}

      {loading ? (
        <p className="rounded-lg border border-token bg-[rgb(var(--surface-muted))/0.5] px-4 py-8 text-center text-sm text-muted">
          Đang tải...
        </p>
      ) : enrollments.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-token bg-[rgb(var(--surface-muted))/0.4] px-6 py-12 text-center">
          <span className="text-4xl" aria-hidden>
            👤
          </span>
          <p className="text-sm font-semibold">
            {search.trim() || filter !== "all"
              ? "Không có enrollment khớp bộ lọc"
              : "Khóa chưa có học viên"}
          </p>
          <p className="text-xs text-muted">
            {search.trim() || filter !== "all"
              ? "Thử bỏ filter hoặc đổi từ khóa."
              : "Dùng nút Import để thêm hàng loạt từ CSV."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))]">
          <div className="relative">
          <div className="overflow-x-auto" ref={tableWrapRef} onScroll={updateScrollUI}>
          <table className="w-full text-sm">
            <thead className="bg-[rgb(var(--surface-muted))/0.5] text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <SortableHeader
                  label="Học viên"
                  sortKey="name"
                  current={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                  className="sticky left-0 z-[3] border-r border-token bg-[rgb(var(--surface-muted))]"
                />
                <SortableHeader label="Lớp" sortKey="section" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader label="Trạng thái" sortKey="status" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortableHeader
                  label="Đăng ký"
                  sortKey="enrolledAt"
                  current={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                  className="hidden sm:table-cell"
                />
                <SortableHeader
                  label="Hoạt động gần nhất"
                  sortKey="lastActivityAt"
                  current={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                  className="hidden md:table-cell"
                />
                <th className="px-4 py-2 hidden lg:table-cell">v</th>
                <th className="px-4 py-2 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-token">
              {sortedEnrollments.map((e) => (
                <tr key={e.id} className="group hover:bg-[rgb(var(--surface-muted))/0.3]">
                  <td className="sticky left-0 z-[1] border-r border-token bg-[rgb(var(--surface))] px-4 py-2.5 group-hover:bg-[rgb(var(--surface-muted))]">
                    <div className="flex items-center gap-3">
                      {e.user.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={e.user.avatarUrl}
                          alt=""
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-700">
                          {(e.user.displayName ?? e.user.email)
                            .slice(0, 1)
                            .toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {e.user.displayName ?? "—"}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {e.user.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  {/* Lớp: chưa gán thì phải nhìn ra ngay, vì đó là việc cần
                      làm chứ không phải một trạng thái bình thường. */}
                  <td className="px-4 py-2.5">
                    {e.section.isDefault ? (
                      <span className="chip-accent whitespace-nowrap text-xs">
                        chưa gán lớp
                      </span>
                    ) : (
                      <span className="whitespace-nowrap text-sm">{e.section.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`${STATUS_CHIP[e.status]} text-xs`}>
                      {STATUS_LABEL[e.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 hidden sm:table-cell text-xs text-muted">
                    {formatDate(e.enrolledAt)}
                  </td>
                  <td className="px-4 py-2.5 hidden md:table-cell text-xs text-muted">
                    {e.lastActivityAt ? (
                      <DateTime value={e.lastActivityAt} format="relative" />
                    ) : (
                      <span className="text-faint">chưa có hoạt động</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 hidden lg:table-cell text-xs text-faint">
                    v{e.courseVersion}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <EnrollmentActionsMenu
                      enrollment={e}
                      sections={sections}
                      busy={busyId === e.id}
                      onAssignSection={(sectionId) => assignSection(e, sectionId)}
                      onChangeStatus={(status) => changeStatus(e, status)}
                      onRemove={() => removeEnrollment(e)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {scrollUI.overflow && (
            <div
              aria-hidden
              className={`pointer-events-none absolute inset-y-0 right-0 w-9 bg-gradient-to-l from-[rgb(var(--surface))] to-transparent transition-opacity ${
                scrollUI.atEnd ? "opacity-0" : "opacity-100"
              }`}
            />
          )}
          </div>
          {scrollUI.overflow && (
            <div className="flex items-center gap-2 border-t border-token bg-[rgb(var(--surface-muted))/0.3] px-3 py-1.5">
              <ArrowLeftRight className="h-3 w-3 shrink-0 text-faint" aria-hidden />
              <div
                ref={scrollTrackRef}
                onClick={onTrackClick}
                className="relative h-1.5 flex-1 cursor-pointer rounded-full bg-[rgb(var(--border))]"
              >
                <div
                  onMouseDown={onThumbMouseDown}
                  style={{ width: `${scrollUI.thumbWidthPct}%`, left: `${scrollUI.thumbLeftPct}%` }}
                  className="absolute top-0 h-1.5 cursor-grab rounded-full bg-brand-500/80 transition-colors hover:bg-brand-600 active:cursor-grabbing active:bg-brand-600"
                />
              </div>
            </div>
          )}
          <p className="border-t border-token bg-[rgb(var(--surface-muted))/0.3] px-4 py-2 text-xs text-faint">
            Hiển thị {sortedEnrollments.length} kết quả
            {sortedEnrollments.length === 100 && " (giới hạn 100, dùng filter để thu hẹp)"}
            {scrollUI.overflow && (
              <span className="ml-2 font-medium text-brand-700">
                · còn cột bên phải — kéo thanh cuộn ở trên hoặc cuộn ngang trên bảng
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

function SortableHeader({
  label,
  sortKey,
  current,
  dir,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = sortKey === current;
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className={`px-4 py-2 ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-default ${
          active ? "text-default" : ""
        }`}
      >
        {label}
        <Icon className={`h-3 w-3 shrink-0 ${active ? "" : "opacity-40"}`} aria-hidden />
      </button>
    </th>
  );
}

function StatCard({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone?: "success" | "brand" | "danger";
  active?: boolean;
  onClick: () => void;
}) {
  const ring = active
    ? tone === "success"
      ? "ring-2 ring-success-300"
      : tone === "brand"
        ? "ring-2 ring-brand-300"
        : tone === "danger"
          ? "ring-2 ring-danger-300"
          : "ring-2 ring-brand-300"
    : "";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border border-token bg-[rgb(var(--surface))] px-3 py-3 text-left transition-all hover:bg-[rgb(var(--surface-muted))] ${ring}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-faint">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </button>
  );
}

/**
 * Gộp "gán lớp" + "đổi trạng thái" + "xoá" vào một menu kebab thay vì 2 select
 * + 1 nút chen nhau trong ô bảng hẹp (select bị cắt chữ, nút Xoá rớt xuống
 * dòng dưới, lệch hàng). Cùng pattern với LessonActionMenu.tsx.
 */
function EnrollmentActionsMenu({
  enrollment,
  sections,
  busy,
  onAssignSection,
  onChangeStatus,
  onRemove,
}: {
  enrollment: Enrollment;
  sections: SectionOption[];
  busy: boolean;
  onAssignSection: (sectionId: string) => void;
  onChangeStatus: (status: Enrollment["status"]) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  // Toạ độ menu tính từ nút bấm, render qua portal — bảng bọc ngoài có
  // overflow-hidden (để bo góc), một menu absolute bình thường ở hàng cuối
  // sẽ bị cắt cụt mất phần lớn. Portal ra <body> + position:fixed thoát
  // hẳn khỏi mọi ancestor overflow.
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRectRef = useRef<DOMRect | null>(null);
  const label = enrollment.user.displayName ?? enrollment.user.email;

  function openMenu() {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      btnRectRef.current = rect;
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen(true);
  }

  // Menu có thể cao hơn khoảng trống còn lại dưới nút (hàng gần cuối bảng,
  // menu "Gán lớp" dài vì nhiều lớp) — nếu vậy lật lên mở phía trên nút
  // thay vì để nó tụt xuống dưới màn hình, nhìn như bị "che mất".
  useLayoutEffect(() => {
    if (!open || !pos || !menuRef.current || !btnRectRef.current) return;
    const rect = btnRectRef.current;
    const menuHeight = menuRef.current.offsetHeight;
    const margin = 8;
    const fitsBelow = rect.bottom + 4 + menuHeight <= window.innerHeight - margin;
    const top = fitsBelow
      ? rect.bottom + 4
      : Math.max(margin, rect.top - menuHeight - 4);
    if (top !== pos.top) setPos((p) => (p ? { ...p, top } : p));
  }, [open, pos]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (
        !btnRef.current?.contains(e.target as Node) &&
        !menuRef.current?.contains(e.target as Node)
      )
        setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    // Cuộn trang/resize thì đóng luôn thay vì đuổi theo tính lại vị trí —
    // đơn giản hơn nhiều mà UX vẫn ổn, vì đây chỉ là menu ngắn hạn.
    function onScrollOrResize() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  const currentSectionId = enrollment.section.isDefault
    ? ""
    : sectionIdOf(enrollment, sections);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        disabled={busy}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition-colors hover:bg-[rgb(var(--surface-muted))] hover:text-default disabled:opacity-50"
        title={`Hành động cho ${label}`}
        aria-label={`Hành động cho ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: pos.top, right: pos.right }}
            className="fixed z-30 max-h-[80vh] min-w-[220px] overflow-y-auto rounded-xl border border-token bg-[rgb(var(--surface))] py-1 shadow-2xl"
          >
            {sections.length > 0 && (
              <>
                <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-faint">
                  Gán lớp
                </p>
                {sections.map((sec) => (
                  <MenuItem
                    key={sec.id}
                    Icon={Layers}
                    label={sec.name}
                    selected={sec.id === currentSectionId}
                    onClick={() => {
                      onAssignSection(sec.id);
                      setOpen(false);
                    }}
                  />
                ))}
                <div role="separator" className="my-1 border-t border-token" />
              </>
            )}
            <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-faint">
              Trạng thái
            </p>
            {(Object.keys(STATUS_LABEL) as Enrollment["status"][]).map((s) => (
              <MenuItem
                key={s}
                dotClassName={STATUS_DOT[s]}
                label={STATUS_LABEL[s]}
                selected={s === enrollment.status}
                onClick={() => {
                  onChangeStatus(s);
                  setOpen(false);
                }}
              />
            ))}
            <div role="separator" className="my-1 border-t border-token" />
            <MenuItem
              Icon={Trash2}
              label="Xoá khỏi khoá học"
              danger
              onClick={() => {
                setOpen(false);
                onRemove();
              }}
            />
          </div>,
          document.body,
        )}
    </>
  );
}

function MenuItem({
  Icon,
  dotClassName,
  label,
  selected,
  danger,
  onClick,
}: {
  Icon?: ComponentType<SVGProps<SVGSVGElement>>;
  /** Chấm màu thay icon — dùng cho trạng thái, khớp màu với STATUS_CHIP. */
  dotClassName?: string;
  label: string;
  selected?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
        danger
          ? "text-danger-600 hover:bg-danger-50"
          : "hover:bg-[rgb(var(--surface-muted))]"
      }`}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
      {dotClassName && (
        <span className={`h-2 w-2 shrink-0 rounded-full ${dotClassName}`} aria-hidden />
      )}
      <span className="flex-1 truncate">{label}</span>
      {selected && <Check className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />}
    </button>
  );
}
