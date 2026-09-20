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
} from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { formatDate } from "@/lib/datetime";
import DateTime from "@/components/ui/DateTime";
import UserAvatar from "@/components/ui/UserAvatar";

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
  const [wrapEl, setWrapEl] = useState<HTMLDivElement | null>(null);
  // Cột "Đăng ký" ẩn dưới 640px, "Hoạt động gần nhất" ẩn dưới 768px như trước.
  const showEnrolled = useMediaMin(640);
  const showActivity = useMediaMin(768);
  const visibleCols: ColumnId[] = [
    "name",
    "section",
    "status",
    ...(showEnrolled ? (["enrolledAt"] as const) : []),
    ...(showActivity ? (["lastActivityAt"] as const) : []),
    "actions",
  ];
  const { widths, startResize, reset: resetWidth, isManual } = useColumnWidths(wrapEl, visibleCols);
  const tableWidth =
    widths.name +
    widths.section +
    widths.status +
    widths.actions +
    (showEnrolled ? widths.enrolledAt : 0) +
    (showActivity ? widths.lastActivityAt : 0);
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
          <div ref={setWrapEl} className="overflow-x-auto">
          <table
            className="text-sm"
            // Tự co: luôn 100% khung (không để bảng tự phình làm sai phép đo bề rộng
            // khung). Thủ công: đúng tổng độ rộng người dùng đã kéo.
            style={{
              tableLayout: "fixed",
              width: isManual ? tableWidth : "100%",
              minWidth: isManual ? "100%" : undefined,
            }}
          >
            <colgroup>
              <col style={{ width: widths.name }} />
              <col style={{ width: widths.section }} />
              <col style={{ width: widths.status }} />
              {showEnrolled && <col style={{ width: widths.enrolledAt }} />}
              {showActivity && <col style={{ width: widths.lastActivityAt }} />}
              <col style={{ width: widths.actions }} />
            </colgroup>
            <thead className="bg-[rgb(var(--surface-muted))/0.5] text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <SortableHeader
                  label="Học viên"
                  sortKey="name"
                  current={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                  handle={<ResizeHandle id="name" onStart={startResize} onReset={resetWidth} />}
                />
                <SortableHeader
                  label="Lớp"
                  sortKey="section"
                  current={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                  handle={<ResizeHandle id="section" onStart={startResize} onReset={resetWidth} />}
                />
                <SortableHeader
                  label="Trạng thái"
                  sortKey="status"
                  current={sortKey}
                  dir={sortDir}
                  onSort={toggleSort}
                  handle={<ResizeHandle id="status" onStart={startResize} onReset={resetWidth} />}
                />
                {showEnrolled && (
                  <SortableHeader
                    label="Đăng ký"
                    sortKey="enrolledAt"
                    current={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                    handle={<ResizeHandle id="enrolledAt" onStart={startResize} onReset={resetWidth} />}
                  />
                )}
                {showActivity && (
                  <SortableHeader
                    label="Hoạt động gần nhất"
                    sortKey="lastActivityAt"
                    current={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                    handle={<ResizeHandle id="lastActivityAt" onStart={startResize} onReset={resetWidth} />}
                  />
                )}
                <th className="relative px-4 py-2 text-right">
                  Hành động
                  <ResizeHandle id="actions" onStart={startResize} onReset={resetWidth} />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-token">
              {sortedEnrollments.map((e) => (
                <tr key={e.id} className="hover:bg-[rgb(var(--surface-muted))/0.3]">
                  <td className="overflow-hidden px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        name={e.user.displayName ?? e.user.email}
                        imageUrl={e.user.avatarUrl}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium" title={e.user.displayName ?? undefined}>
                          {e.user.displayName ?? "—"}
                        </p>
                        <p className="truncate text-xs text-muted" title={e.user.email}>
                          {e.user.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  {/* Lớp: chưa gán thì phải nhìn ra ngay, vì đó là việc cần
                      làm chứ không phải một trạng thái bình thường. Cắt ngắn
                      tên lớp dài (mã lớp học phần + tên đầy đủ) xuống dòng khi
                      hết chỗ, chữ nhỏ để đọc được cả tên mà không đẩy các cột
                      sau (trạng thái, ngày, hoạt động) khỏi màn hình. */}
                  <td className="overflow-hidden px-4 py-2.5">
                    {e.section.isDefault ? (
                      <span className="chip-accent whitespace-nowrap text-xs">
                        chưa gán lớp
                      </span>
                    ) : (
                      <span className="block break-words text-xs leading-snug" title={e.section.name}>
                        {e.section.name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`${STATUS_CHIP[e.status]} text-xs`}>
                      {STATUS_LABEL[e.status]}
                    </span>
                  </td>
                  {showEnrolled && (
                  <td className="overflow-hidden px-4 py-2.5 text-xs text-muted">
                    {formatDate(e.enrolledAt)}
                  </td>
                  )}
                  {showActivity && (
                  <td className="overflow-hidden px-4 py-2.5 text-xs text-muted">
                    {e.lastActivityAt ? (
                      <DateTime value={e.lastActivityAt} format="relative" />
                    ) : (
                      <span className="text-faint">chưa có hoạt động</span>
                    )}
                  </td>
                  )}
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
          <p className="border-t border-token bg-[rgb(var(--surface-muted))/0.3] px-4 py-2 text-xs text-faint">
            Hiển thị {sortedEnrollments.length} kết quả
            {sortedEnrollments.length === 100 && " (giới hạn 100, dùng filter để thu hẹp)"}
          </p>
        </div>
      )}
    </div>
  );
}

// Cột của bảng học viên: người dùng kéo mép phải tiêu đề cột để đổi độ rộng
// (nhớ theo trình duyệt), bấm đúp vào mép để tự co lại cho vừa khung.
const COLUMNS = [
  { id: "name", w: 230, min: 140 },
  { id: "section", w: 190, min: 120 },
  { id: "status", w: 120, min: 90 },
  { id: "enrolledAt", w: 120, min: 90 },
  { id: "lastActivityAt", w: 150, min: 110 },
  { id: "actions", w: 90, min: 80 },
] as const;
type ColumnId = (typeof COLUMNS)[number]["id"];
const COL_STORAGE_KEY = "fbm.enrollmentTable.colWidths";

function defaultWidths(): Record<ColumnId, number> {
  return Object.fromEntries(COLUMNS.map((c) => [c.id, c.w])) as Record<ColumnId, number>;
}

function useMediaMin(px: number): boolean {
  const [ok, setOk] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${px}px)`);
    const on = () => setOk(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [px]);
  return ok;
}

/**
 * Chia đều `containerW` cho các cột đang hiện theo tỉ lệ độ rộng mặc định, cột
 * nào nhỏ hơn mức tối thiểu thì ghim ở mức tối thiểu rồi chia lại phần còn lại.
 * Đây là độ rộng "tự co" khi người dùng chưa tự chỉnh.
 */
function fitWidths(containerW: number, visible: ColumnId[]): Record<ColumnId, number> {
  const out = defaultWidths();
  if (containerW <= 0) return out;
  let free = COLUMNS.filter((c) => visible.includes(c.id));
  let remaining = containerW;
  for (let pass = 0; pass < COLUMNS.length; pass++) {
    const total = free.reduce((sum, c) => sum + c.w, 0);
    if (total === 0) break;
    const tooSmall = free.filter((c) => (remaining * c.w) / total < c.min);
    if (tooSmall.length === 0) break;
    for (const c of tooSmall) {
      out[c.id] = c.min;
      remaining -= c.min;
    }
    free = free.filter((c) => !tooSmall.includes(c));
  }
  const total = free.reduce((sum, c) => sum + c.w, 0);
  for (const c of free) out[c.id] = Math.floor((remaining * c.w) / total);
  return out;
}

/**
 * Độ rộng cột: mặc định TỰ CO cho vừa khung (theo bề rộng thật của bảng). Khi
 * người dùng kéo một cột thì chuyển sang độ rộng thủ công cho cả bảng, nhớ theo
 * trình duyệt; bấm đúp vào thanh kéo để quay về tự co.
 */
function useColumnWidths(wrap: HTMLElement | null, visible: ColumnId[]) {
  const [containerW, setContainerW] = useState(0);
  const [manual, setManual] = useState<Record<ColumnId, number> | null>(null);

  useLayoutEffect(() => {
    if (!wrap) return;
    setContainerW(wrap.clientWidth);
    const ro = new ResizeObserver(() => setContainerW(wrap.clientWidth));
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [wrap]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COL_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<Record<ColumnId, number>>;
      const next = defaultWidths();
      let ok = true;
      for (const c of COLUMNS) {
        const v = saved[c.id];
        if (typeof v === "number" && v >= c.min && v <= 800) next[c.id] = v;
        else ok = false;
      }
      if (ok) setManual(next);
    } catch {
      /* không đọc được thì để tự co */
    }
  }, []);

  const widths = manual ?? fitWidths(containerW, visible);

  const startResize = (id: ColumnId, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const col = COLUMNS.find((c) => c.id === id)!;
    const base = { ...widths };
    const startX = e.clientX;
    const startW = base[id];
    let latest: Record<ColumnId, number> = base;
    const move = (ev: PointerEvent) => {
      const w = Math.min(800, Math.max(col.min, startW + ev.clientX - startX));
      latest = { ...base, [id]: w };
      setManual(latest);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      try {
        localStorage.setItem(COL_STORAGE_KEY, JSON.stringify(latest));
      } catch {
        /* không lưu được thì thôi */
      }
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const reset = () => {
    setManual(null);
    try {
      localStorage.removeItem(COL_STORAGE_KEY);
    } catch {
      /* bỏ qua */
    }
  };

  return { widths, startResize, reset, isManual: manual !== null };
}

function ResizeHandle({
  id,
  onStart,
  onReset,
}: {
  id: ColumnId;
  onStart: (id: ColumnId, e: React.PointerEvent) => void;
  onReset: () => void;
}) {
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label="Kéo để đổi độ rộng cột, bấm đúp để tự co lại cho vừa khung"
      title="Kéo để đổi độ rộng cột · bấm đúp để tự co lại cho vừa khung"
      onPointerDown={(e) => onStart(id, e)}
      onDoubleClick={onReset}
      className="group/rs absolute right-0 top-0 z-10 flex h-full w-3 cursor-col-resize touch-none items-center justify-center"
    >
      <span className="h-4 w-px bg-[rgb(var(--border))] transition-colors group-hover/rs:h-full group-hover/rs:bg-brand-500" />
    </span>
  );
}

function SortableHeader({
  label,
  sortKey,
  current,
  dir,
  onSort,
  className = "",
  handle,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
  handle?: React.ReactNode;
}) {
  const active = sortKey === current;
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className={`relative px-4 py-2 ${className}`}>
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
      {handle}
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
