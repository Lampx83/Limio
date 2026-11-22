"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UserAvatar, StatusBadge, DateTime } from "@/components/ui";
import { apiUrl } from "@/lib/apiUrl";
import { toast } from "@/lib/toast";
import SubmissionModal from "./SubmissionModal";
import type { SavedAiSuggestion } from "./GradeForm";
import { neighborSubmissions } from "./submissionNav";

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

const APPLY_SKIP_LABEL: Record<string, string> = {
  no_suggestion: "chưa có gợi ý",
  stale: "bài đã được nộp lại sau gợi ý",
  already_graded: "đã được chấm",
  score_exceeds_max: "điểm gợi ý vượt thang",
  failed: "lỗi khi lưu",
};

export default function RosterTable({
  roster,
  maxScore,
  assignmentId,
  rubricText,
  suggestions = {},
}: {
  roster: RosterRow[];
  maxScore: number;
  assignmentId: string;
  rubricText: string | null;
  /** Gợi ý AI đã lưu (chấm hàng loạt), theo submissionId. */
  suggestions?: Record<string, SavedAiSuggestion>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [aiOnly, setAiOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [sectionId, setSectionId] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [openSubmissionId, setOpenSubmissionId] = useState<string | null>(null);
  const [pendingOnly, setPendingOnly] = useState(false);

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
      if (aiOnly && !(r.submission && suggestions[r.submission.id])) return false;
      if (!q) return true;
      return (
        normalizeForSearch(r.user.displayName).includes(q) ||
        normalizeForSearch(r.user.email).includes(q)
      );
    });
  }, [roster, search, sectionId, aiOnly, suggestions]);

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

  // Chỉ chốt hàng loạt được bài chưa chấm có gợi ý còn mới (đúng điều server cũng kiểm).
  const eligibleIds = useMemo(
    () =>
      sorted
        .filter((r) => r.submission && r.submission.status === "submitted" && suggestions[r.submission.id]?.state === "fresh")
        .map((r) => r.submission!.id),
    [sorted, suggestions],
  );
  const selectedEligible = eligibleIds.filter((id) => selected.has(id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function applySelected() {
    const ids = selectedEligible;
    if (ids.length === 0) return;
    if (
      !window.confirm(
        `Chốt điểm theo gợi ý AI cho ${ids.length} bài?\n\nĐiểm thật và nhận xét sẽ được ghi và học viên thấy ngay. Bạn nên xem lại các gợi ý trước khi chốt.`,
      )
    )
      return;
    setApplying(true);
    try {
      const res = await fetch(apiUrl(`/api/assignments/${assignmentId}/ai-grade/apply`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionIds: ids }),
      });
      const d = (await res.json().catch(() => ({}))) as {
        applied?: string[];
        skipped?: { submissionId: string; reason: string }[];
        error?: string;
      };
      if (!res.ok) {
        toast.error(d.error === "forbidden" ? "Bạn không có quyền chấm bài này." : "Không chốt được điểm. Thử lại sau.");
        return;
      }
      const applied = d.applied?.length ?? 0;
      toast.success(`Đã chốt ${applied} bài theo gợi ý AI.`);
      if (d.skipped?.length) {
        const why = Array.from(new Set(d.skipped.map((x) => APPLY_SKIP_LABEL[x.reason] ?? x.reason))).join("; ");
        toast.error(`${d.skipped.length} bài chưa chốt: ${why}.`);
      }
      setSelected(new Set());
      router.refresh();
    } catch {
      toast.error("Mất kết nối tới máy chủ. Kiểm tra mạng rồi thử lại.");
    } finally {
      setApplying(false);
    }
  }

  const openRow = sorted.find((r) => r.submission?.id === openSubmissionId) ?? null;
  // Trước/Sau đi theo đúng thứ tự bảng GV đang thấy (đã lọc + sắp xếp).
  const nav = openSubmissionId
    ? neighborSubmissions(sorted, openSubmissionId, pendingOnly)
    : null;

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
        {Object.keys(suggestions).length > 0 && (
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted">
            <input type="checkbox" checked={aiOnly} onChange={(e) => setAiOnly(e.target.checked)} />
            Chỉ bài có gợi ý AI
          </label>
        )}
      </div>

      {eligibleIds.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-900">
          <span>
            ✨ {eligibleIds.length} bài có gợi ý AI chưa chốt. Đã chọn {selectedEligible.length}.
          </span>
          <button
            type="button"
            className="underline"
            onClick={() =>
              setSelected(selectedEligible.length === eligibleIds.length ? new Set() : new Set(eligibleIds))
            }
          >
            {selectedEligible.length === eligibleIds.length ? "Bỏ chọn tất cả" : "Chọn tất cả bài có gợi ý"}
          </button>
          <button
            type="button"
            disabled={applying || selectedEligible.length === 0}
            onClick={applySelected}
            className="btn-primary btn-sm ml-auto disabled:opacity-50"
          >
            {applying ? "Đang chốt…" : `Chốt theo gợi ý AI cho ${selectedEligible.length} bài`}
          </button>
        </div>
      )}

      <div className="mt-3 overflow-x-auto rounded-2xl border border-token">
        <table className="w-full text-sm">
          <thead className="bg-[rgb(var(--surface-muted))] text-left text-xs text-faint">
            <tr className="border-b border-token">
              {eligibleIds.length > 0 && <th className="w-8 px-3 py-2 font-medium"><span className="sr-only">Chọn</span></th>}
              <th className="px-3 py-2 font-medium">STT</th>
              <SortableHeader label="Người nộp" sortKey="name" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortableHeader label="Lớp" sortKey="section" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortableHeader label="Trạng thái" sortKey="status" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortableHeader label="Ngày giờ nộp" sortKey="submittedAt" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <th className="px-3 py-2 font-medium">Bài làm</th>
              {Object.keys(suggestions).length > 0 && <th className="px-3 py-2 font-medium">Gợi ý AI</th>}
              <SortableHeader label="Điểm" sortKey="score" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-token">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-sm text-faint">
                  Không tìm thấy học viên khớp bộ lọc.
                </td>
              </tr>
            ) : (
              sorted.map((r, i) => {
                const s = r.submission;
                const isGraded = s?.status === "graded";
                const sug = s ? suggestions[s.id] : undefined;
                const canPick = !!s && eligibleIds.includes(s.id);
                return (
                  <tr key={r.user.id}>
                    {eligibleIds.length > 0 && (
                      <td className="px-3 py-2">
                        {canPick && s ? (
                          <input
                            type="checkbox"
                            checked={selected.has(s.id)}
                            onChange={() => toggleOne(s.id)}
                            aria-label={`Chọn bài của ${r.user.displayName}`}
                          />
                        ) : null}
                      </td>
                    )}
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
                        {s ? (isGraded ? "Đã chấm" : "Đã nộp") : "Chưa nộp"}
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
                    {Object.keys(suggestions).length > 0 && (
                      <td className="px-3 py-2 text-xs">
                        {!sug ? (
                          <span className="text-faint">—</span>
                        ) : isGraded ? (
                          <span className="text-faint">{sug.score}/{maxScore}</span>
                        ) : sug.state === "stale" ? (
                          <span className="text-warning-700" title="Học viên đã nộp lại sau khi AI đọc">
                            {sug.score}/{maxScore} · đã cũ
                          </span>
                        ) : (
                          <span className="font-medium text-violet-700">✨ {sug.score}/{maxScore}</span>
                        )}
                      </td>
                    )}
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
          assignmentId={assignmentId}
          rubricText={rubricText}
          aiSuggestion={suggestions[openRow.submission.id] ?? null}
          nav={
            nav && {
              position: nav.position,
              total: nav.total,
              pendingOnly,
              onTogglePendingOnly: setPendingOnly,
              onPrev: nav.prevId ? () => setOpenSubmissionId(nav.prevId) : null,
              onNext: nav.nextId ? () => setOpenSubmissionId(nav.nextId) : null,
            }
          }
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
