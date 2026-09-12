"use client";

import { useEffect, useState, useCallback } from "react";
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

export default function EnrollmentList({ courseId }: { courseId: string }) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          <table className="w-full text-sm">
            <thead className="bg-[rgb(var(--surface-muted))/0.5] text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2">Học viên</th>
                <th className="px-4 py-2">Lớp</th>
                <th className="px-4 py-2">Trạng thái</th>
                <th className="px-4 py-2 hidden sm:table-cell">Đăng ký</th>
                <th className="px-4 py-2 hidden md:table-cell">Hoạt động gần nhất</th>
                <th className="px-4 py-2 hidden lg:table-cell">v</th>
                <th className="px-4 py-2 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-token">
              {enrollments.map((e) => (
                <tr key={e.id} className="hover:bg-[rgb(var(--surface-muted))/0.3]">
                  <td className="px-4 py-2.5">
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
                    {/* Gán lớp đứng trước đổi trạng thái: với một khoá đang
                        chạy hai lớp song song thì xếp lớp là việc làm thường
                        xuyên hơn nhiều so với đánh dấu bỏ học. */}
                    {sections.length > 0 && (
                      <select
                        value={e.section.isDefault ? "" : sectionIdOf(e, sections)}
                        disabled={busyId === e.id}
                        onChange={(ev) => assignSection(e, ev.target.value)}
                        aria-label={`Gán lớp cho ${e.user.displayName ?? e.user.email}`}
                        className="select mr-2 py-1 text-xs"
                      >
                        <option value="" disabled>
                          — gán lớp —
                        </option>
                        {sections.map((sec) => (
                          <option key={sec.id} value={sec.id}>
                            {sec.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <select
                      value={e.status}
                      disabled={busyId === e.id}
                      onChange={(ev) =>
                        changeStatus(
                          e,
                          ev.target.value as Enrollment["status"],
                        )
                      }
                      className="select mr-2 py-1 text-xs"
                    >
                      {(Object.keys(STATUS_LABEL) as Enrollment["status"][]).map(
                        (s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ),
                      )}
                    </select>
                    {/* Xoá hẳn — khác đổi trạng thái "Bỏ học": enrollment
                        biến mất khỏi DB, không phục hồi được. Đứng cuối
                        cùng, tách biệt bằng màu danger, và luôn confirm. */}
                    <button
                      type="button"
                      disabled={busyId === e.id}
                      onClick={() => removeEnrollment(e)}
                      aria-label={`Xoá ${e.user.displayName ?? e.user.email} khỏi khoá học`}
                      className="rounded-lg border border-token px-2 py-1 text-xs font-medium text-danger-700 transition-colors hover:border-danger-500 hover:bg-danger-50 disabled:opacity-50"
                    >
                      Xoá
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-token bg-[rgb(var(--surface-muted))/0.3] px-4 py-2 text-xs text-faint">
            Hiển thị {enrollments.length} kết quả
            {enrollments.length === 100 && " (giới hạn 100, dùng filter để thu hẹp)"}
          </p>
        </div>
      )}
    </div>
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
