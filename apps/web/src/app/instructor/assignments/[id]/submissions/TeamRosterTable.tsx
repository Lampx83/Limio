"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { TeamSubmissionEntry } from "@feedbackme/core-lms";
import { DateTime, EmptyState, StatusBadge, UserAvatar } from "@/components/ui";
import TeamSubmissionModal from "./TeamSubmissionModal";
import { neighborTeams } from "./teamNav";

type MiniUser = { id: string; displayName: string; email: string };
type StatusFilter = "all" | "pending" | "graded" | "none";

function normalizeForSearch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function statusOf(e: TeamSubmissionEntry): Exclude<StatusFilter, "all"> {
  if (!e.latest) return "none";
  return e.latest.status === "graded" ? "graded" : "pending";
}

/** Danh sách chấm bài nhóm — mỗi nhóm một dòng (AC D1). */
export default function TeamRosterTable({
  entries,
  unassigned,
  maxScore,
  courseId,
}: {
  entries: TeamSubmissionEntry[];
  unassigned: MiniUser[];
  maxScore: number;
  courseId: string;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [openTeamId, setOpenTeamId] = useState<string | null>(null);
  const [pendingOnly, setPendingOnly] = useState(false);

  const visible = useMemo(() => {
    const q = normalizeForSearch(search.trim());
    return entries.filter((e) => {
      if (status !== "all" && statusOf(e) !== status) return false;
      if (!q) return true;
      const people = [...e.currentMembers, ...(e.latest?.members.map((m) => m.user) ?? [])];
      return (
        normalizeForSearch(e.team.name).includes(q) ||
        people.some((u) => normalizeForSearch(u.displayName).includes(q) || normalizeForSearch(u.email).includes(q))
      );
    });
  }, [entries, search, status]);

  const open = visible.find((e) => e.team.id === openTeamId) ?? entries.find((e) => e.team.id === openTeamId) ?? null;
  // Trước/Sau đi theo nhóm, đúng thứ tự GV đang thấy (đã lọc).
  const nav = openTeamId ? neighborTeams(visible, openTeamId, pendingOnly) : null;

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên nhóm hoặc thành viên..."
          className="input w-full max-w-xs"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className="input w-auto"
          aria-label="Lọc theo trạng thái"
        >
          <option value="all">Mọi trạng thái</option>
          <option value="pending">Chờ chấm</option>
          <option value="graded">Đã chấm</option>
          <option value="none">Chưa nộp</option>
        </select>
        <span className="text-caption">
          Hiển thị {visible.length}/{entries.length} nhóm
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            icon="👥"
            title="Khoá học chưa có nhóm nào"
            description="Sinh viên tự lập nhóm ở trang khoá học. Bài nộp của nhóm sẽ hiện ở đây."
            actions={[{ label: "Xem các nhóm", href: `/instructor/courses/${courseId}/teams`, variant: "secondary" }]}
          />
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-2xl border border-token">
          <table className="w-full text-sm">
            <thead className="bg-[rgb(var(--surface-muted))] text-left text-xs text-faint">
              <tr className="border-b border-token">
                <th className="px-3 py-2 font-medium">STT</th>
                <th className="px-3 py-2 font-medium">Nhóm</th>
                <th className="px-3 py-2 font-medium">Trạng thái</th>
                <th className="px-3 py-2 font-medium">Người nộp</th>
                <th className="px-3 py-2 font-medium">Bài làm</th>
                <th className="px-3 py-2 text-right font-medium">Điểm nhóm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-token">
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-faint">
                    Không có nhóm nào khớp bộ lọc.
                  </td>
                </tr>
              ) : (
                visible.map((e, i) => {
                  const s = e.latest;
                  const st = statusOf(e);
                  return (
                    <tr key={e.team.id}>
                      <td className="px-3 py-2 align-top tabular-nums text-muted">{i + 1}</td>
                      <td className="px-3 py-2 align-top">
                        <p className="font-medium">{e.team.name}</p>
                        <p className="text-caption max-w-xs">
                          {e.currentMembers.length === 0
                            ? "Nhóm trống"
                            : e.currentMembers.map((u) => u.displayName).join(", ")}
                        </p>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <StatusBadge tone={st === "graded" ? "success" : st === "pending" ? "warning" : "neutral"}>
                          {st === "graded" ? "Đã chấm" : st === "pending" ? "Đã nộp" : "Chưa nộp"}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-2 align-top text-muted">
                        {s ? (
                          <>
                            <p className="text-sm">{s.submittedBy?.displayName ?? "—"}</p>
                            <DateTime value={s.teamSubmittedAt} format="datetime" className="text-caption" />
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {s ? (
                          <button type="button" onClick={() => setOpenTeamId(e.team.id)} className="link text-xs">
                            Xem bài làm
                          </button>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right align-top tabular-nums">
                        {!s ? (
                          <span className="text-faint">—</span>
                        ) : s.status === "graded" && s.teamScore != null ? (
                          <>
                            <span className="font-semibold">
                              {s.teamScore}/{maxScore}
                            </span>
                            {s.members.some((m) => m.scoreOverridden) && (
                              <p className="text-caption">có điểm riêng</p>
                            )}
                          </>
                        ) : (
                          <span className="text-faint">Chưa chấm</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-h4">
          Sinh viên chưa có nhóm <span className="text-meta font-normal">({unassigned.length})</span>
        </h2>
        {unassigned.length === 0 ? (
          <p className="text-meta mt-2">Mọi sinh viên đều đã có nhóm.</p>
        ) : (
          <>
            <p className="text-meta mt-1">
              Chưa vào nhóm thì chưa nộp được bài này.{" "}
              <Link href={`/instructor/courses/${courseId}/teams`} className="link">
                Xếp nhóm
              </Link>
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {unassigned.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center gap-2 rounded-full border border-token py-1 pl-1 pr-3"
                  title={u.email}
                >
                  <UserAvatar name={u.displayName} size="xs" />
                  <span className="text-sm">{u.displayName}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {open?.latest && (
        <TeamSubmissionModal
          entry={open}
          latest={open.latest}
          maxScore={maxScore}
          nav={
            nav && {
              position: nav.position,
              total: nav.total,
              pendingOnly,
              onTogglePendingOnly: setPendingOnly,
              onPrev: nav.prevId ? () => setOpenTeamId(nav.prevId) : null,
              onNext: nav.nextId ? () => setOpenTeamId(nav.nextId) : null,
            }
          }
          onClose={() => setOpenTeamId(null)}
        />
      )}
    </>
  );
}
