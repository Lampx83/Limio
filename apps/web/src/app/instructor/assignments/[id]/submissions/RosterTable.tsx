"use client";

import { useMemo, useState } from "react";
import { UserAvatar, StatusBadge, DateTime } from "@/components/ui";
import SubmissionModal from "./SubmissionModal";

export type RosterRow = {
  user: { id: string; displayName: string; email: string };
  section: { id: string; name: string } | null;
  submission: {
    id: string;
    status: "submitted" | "graded";
    body: string;
    attachmentUrl: string | null;
    submittedAt: Date;
    score: number | null;
    feedback: string | null;
  } | null;
};

type SortKey = "name" | "section" | "status" | "submittedAt" | "score";
type SortDir = "asc" | "desc";

function normalizeForSearch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

// Trạng thái theo thứ tự tăng dần để sort: chưa nộp < chờ chấm < đã chấm.
function statusRank(r: RosterRow): number {
  if (!r.submission) return 0;
  return r.submission.status === "graded" ? 2 : 1;
}

export default function RosterTable({
  roster,
  maxScore,
}: {
  roster: RosterRow[];
  maxScore: number;
}) {
  const [search, setSearch] = useState("");
  const [sectionId, setSectionId] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [openSubmissionId, setOpenSubmissionId] = useState<string | null>(null);

  const sections = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of roster) if (r.section) map.set(r.section.id, r.section.name);
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], "vi"));
  }, [roster]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    const q = normalizeForSearch(search.trim());
    return roster.filter((r) => {
      if (sectionId !== "all" && r.section?.id !== sectionId) return false;
      if (!q) return true;
      return (
        normalizeForSearch(r.user.displayName).includes(q) ||
        normalizeForSearch(r.user.email).includes(q)
      );
    });
  }, [roster, search, sectionId]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "name":
          return dir * a.user.displayName.localeCompare(b.user.displayName, "vi");
        case "section": {
          const an = a.section?.name ?? "";
          const bn = b.section?.name ?? "";
          if (!an && bn) return 1;
          if (an && !bn) return -1;
          return dir * an.localeCompare(bn, "vi");
        }
        case "status":
          return dir * (statusRank(a) - statusRank(b));
        case "submittedAt": {
          const at = a.submission?.submittedAt.getTime();
          const bt = b.submission?.submittedAt.getTime();
          if (at === undefined && bt === undefined) return 0;
          if (at === undefined) return 1;
          if (bt === undefined) return -1;
          return dir * (at - bt);
        }
        case "score": {
          const as = a.submission?.score;
          const bs = b.submission?.score;
          if (as == null && bs == null) return 0;
          if (as == null) return 1;
          if (bs == null) return -1;
          return dir * (as - bs);
        }
        default:
          return 0;
      }
    });
  }, [filtered, sortKey, sortDir]);

  const openRow = sorted.find((r) => r.submission?.id === openSubmissionId) ?? null;

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên hoặc email học viên..."
          className="input w-full max-w-xs"
        />
        {sections.length > 0 && (
          <select
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            className="input w-auto max-w-[14rem]"
          >
            <option value="all">Tất cả lớp ({roster.length})</option>
            {sections.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        )}
        <span className="text-xs text-faint">
          Hiển thị {sorted.length}/{roster.length}
        </span>
      </div>

      <div className="mt-3 overflow-x-auto rounded-2xl border border-token">
        <table className="w-full text-sm">
          <thead className="bg-[rgb(var(--surface-muted))] text-left text-xs text-faint">
            <tr className="border-b border-token">
              <th className="px-3 py-2 font-medium">STT</th>
              <SortableHeader label="Người nộp" sortKey="name" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortableHeader label="Lớp" sortKey="section" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortableHeader label="Trạng thái" sortKey="status" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortableHeader label="Ngày giờ nộp" sortKey="submittedAt" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <th className="px-3 py-2 font-medium">Bài làm</th>
              <SortableHeader label="Điểm" sortKey="score" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-token">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-faint">
                  Không tìm thấy học viên khớp bộ lọc.
                </td>
              </tr>
            ) : (
              sorted.map((r, i) => {
                const s = r.submission;
                const isGraded = s?.status === "graded";
                return (
                  <tr key={r.user.id}>
                    <td className="px-3 py-2 tabular-nums text-muted">{i + 1}</td>
                    <td className="px-3 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <UserAvatar name={r.user.displayName} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium leading-tight">
                            {r.user.displayName}
                          </p>
                          <p className="truncate text-xs text-faint">{r.user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">
                      {r.section?.name ?? <span className="text-faint">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge tone={s ? (isGraded ? "success" : "warning") : "neutral"}>
                        {s ? "Đã nộp" : "Chưa nộp"}
                      </StatusBadge>
                    </td>
                    <td className="px-3 py-2 text-muted">
                      {s ? <DateTime value={s.submittedAt} format="datetime" /> : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {s ? (
                        <button
                          type="button"
                          onClick={() => setOpenSubmissionId(s.id)}
                          className="link text-xs"
                        >
                          Xem bài làm
                        </button>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {!s ? (
                        <span className="text-faint">—</span>
                      ) : isGraded ? (
                        <span className="font-semibold">
                          {s.score}/{maxScore}
                        </span>
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

      {openRow?.submission && (
        <SubmissionModal
          user={openRow.user}
          submission={openRow.submission}
          maxScore={maxScore}
          onClose={() => setOpenSubmissionId(null)}
        />
      )}
    </>
  );
}

function SortableHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  align?: "right";
}) {
  const active = sortKey === activeKey;
  return (
    <th className={`px-3 py-2 font-medium ${align === "right" ? "text-right" : ""}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-[rgb(var(--text))] ${
          active ? "font-semibold text-[rgb(var(--text))]" : ""
        }`}
      >
        {label}
        <span className="text-[10px]">{active ? (dir === "asc" ? "▲" : "▼") : ""}</span>
      </button>
    </th>
  );
}
