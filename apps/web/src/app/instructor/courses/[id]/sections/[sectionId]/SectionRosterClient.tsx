"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { formatDate } from "@/lib/datetime";

type Status = "active" | "completed" | "dropped" | "refunded" | "expired";

interface RosterEntry {
  enrollmentId: string;
  status: Status;
  enrolledAt: string;
  user: {
    id: string;
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  completedLessons: number;
  totalLessons: number;
  courseCompletionPct: number;
  latestQuizScorePct: number | null;
}

interface Roster {
  section: {
    id: string;
    name: string;
    description: string | null;
    courseId: string;
    courseTitle: string;
  };
  otherSections: Array<{ id: string; name: string }>;
  entries: RosterEntry[];
}

const STATUS_LABEL: Record<Status, string> = {
  active: "Đang học",
  completed: "Đã hoàn thành",
  dropped: "Bỏ học",
  refunded: "Đã hoàn tiền",
  expired: "Hết hạn truy cập",
};

const STATUS_CHIP: Record<Status, string> = {
  active: "chip-success",
  completed: "chip-brand",
  dropped: "chip-danger",
  refunded: "chip-accent",
  expired: "chip-danger",
};

export default function SectionRosterClient({
  courseId,
  sectionId,
  initial,
}: {
  courseId: string;
  sectionId: string;
  initial: Roster;
}) {
  const [roster, setRoster] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const r = await fetch(apiUrl(`/api/sections/${sectionId}/roster`));
    if (!r.ok) {
      setError(`HTTP ${r.status}`);
      return;
    }
    setRoster((await r.json()) as Roster);
  };

  const onTransfer = async (entry: RosterEntry, targetSectionId: string) => {
    if (!targetSectionId) return;
    const targetName =
      roster.otherSections.find((s) => s.id === targetSectionId)?.name ?? "lớp khác";
    if (
      !window.confirm(
        `Chuyển "${entry.user.displayName ?? entry.user.email}" sang lớp "${targetName}"?`,
      )
    )
      return;

    setBusyId(entry.enrollmentId);
    setError(null);
    try {
      const r = await fetch(
        apiUrl(
          `/api/instructor/courses/${courseId}/enrollments/${entry.enrollmentId}`,
        ),
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sectionId: targetSectionId }),
        },
      );
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setError(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mt-6">
      {error && (
        <div className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          ⚠ {error}
        </div>
      )}

      {roster.entries.length === 0 ? (
        <div className="rounded border border-dashed border-default p-6 text-center text-sm text-faint">
          Lớp này chưa có học viên nào. Gửi link mời để học viên tự đăng ký.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))]">
          <table className="w-full text-sm">
            <thead className="bg-[rgb(var(--surface-muted))/0.5] text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2">Học viên</th>
                <th className="px-4 py-2">Trạng thái</th>
                <th className="px-4 py-2 hidden sm:table-cell">Vào lớp</th>
                <th className="px-4 py-2">Tiến độ</th>
                <th className="px-4 py-2">Điểm quiz gần nhất</th>
                {roster.otherSections.length > 0 && (
                  <th className="px-4 py-2 text-right">Chuyển lớp</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-token">
              {roster.entries.map((e) => (
                <tr key={e.enrollmentId} className="hover:bg-[rgb(var(--surface-muted))/0.3]">
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
                          {(e.user.displayName ?? e.user.email).slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium">{e.user.displayName ?? "—"}</p>
                        <p className="truncate text-xs text-muted">{e.user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`${STATUS_CHIP[e.status]} text-xs`}>
                      {STATUS_LABEL[e.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 hidden sm:table-cell text-xs text-muted">
                    {formatDate(e.enrolledAt)}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {e.totalLessons === 0
                      ? "—"
                      : `${e.completedLessons}/${e.totalLessons} bài (${e.courseCompletionPct}%)`}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {e.latestQuizScorePct === null ? "—" : `${Math.round(e.latestQuizScorePct)}%`}
                  </td>
                  {roster.otherSections.length > 0 && (
                    <td className="px-4 py-2.5 text-right">
                      <select
                        value=""
                        disabled={busyId === e.enrollmentId}
                        onChange={(ev) => {
                          const v = ev.target.value;
                          ev.target.value = "";
                          onTransfer(e, v);
                        }}
                        className="select py-1 text-xs"
                      >
                        <option value="">Chuyển sang…</option>
                        {roster.otherSections.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-token bg-[rgb(var(--surface-muted))/0.3] px-4 py-2 text-xs text-faint">
            {roster.entries.length} học viên trong lớp
          </p>
        </div>
      )}
    </div>
  );
}
